import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2, CheckCircle2, Users, UserCog, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { ramaDesdeEdad } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// Campos que se comparan/muestran al resolver duplicados
const CAMPOS_COMPARACION = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'telefono_contacto', label: 'Teléfono' },
  { key: 'email_contacto', label: 'Email' },
  { key: 'fecha_nacimiento', label: 'Fecha Nac.' },
  { key: 'rama', label: 'Rama' },
  { key: 'funcion', label: 'Función' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'zona', label: 'Zona' },
  { key: 'distrito', label: 'Distrito' },
  { key: 'codigo', label: 'Código' },
  { key: 'organismo', label: 'Organismo' },
  { key: 'religion', label: 'Religión' },
  { key: 'provincia', label: 'Provincia' },
  { key: 'localidad', label: 'Localidad' },
  { key: 'calle', label: 'Dirección' },
  { key: 'nacionalidad', label: 'Nacionalidad' },
  { key: 'estudios', label: 'Estudios' },
  { key: 'discapacidad', label: 'Discapacidad' },
  { key: 'fecha_primer_afiliacion', label: 'Primera afiliación' },
];

function parseFecha(str) {
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (isNaN(d)) return str;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Card de un duplicado: muestra los campos que difieren y permite elegir campo a campo o "todo el nuevo"
function DuplicadoCard({ dup, camposSeleccionados, onToggleCampo, onSeleccionarTodo, onMantenerTodo }) {
  const [expanded, setExpanded] = useState(false);

  const camposDiferentes = CAMPOS_COMPARACION.filter(c =>
    (dup.nuevo[c.key] || '') !== (dup.existente[c.key] || '')
    && (dup.nuevo[c.key] || '') !== ''
  );
  const camposIguales = CAMPOS_COMPARACION.filter(c =>
    (dup.nuevo[c.key] || '') === (dup.existente[c.key] || '')
  );

  return (
    <div className="border rounded-lg bg-background overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-muted/30">
        <div>
          <span className="font-medium text-sm">{dup.nuevo.nombre}</span>
          <span className="text-xs text-muted-foreground ml-2">DNI: {dup.nuevo.dni}</span>
          {camposDiferentes.length === 0 ? (
            <Badge className="ml-2 text-xs bg-green-100 text-green-700 border-green-300 border">Sin cambios</Badge>
          ) : (
            <Badge className="ml-2 text-xs bg-amber-100 text-amber-700 border-amber-300 border">{camposDiferentes.length} campo(s) diferente(s)</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {camposDiferentes.length > 0 && (
            <>
              <button onClick={() => onSeleccionarTodo(dup.nuevo.dni, camposDiferentes)} className="text-xs text-primary hover:underline">Aplicar todo</button>
              <button onClick={() => onMantenerTodo(dup.nuevo.dni)} className="text-xs text-muted-foreground hover:underline">Ignorar</button>
            </>
          )}
          <button onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-1.5 text-xs">
          {camposDiferentes.length === 0 ? (
            <p className="text-muted-foreground">Todos los campos son idénticos al existente.</p>
          ) : (
            <>
              <p className="font-medium text-muted-foreground mb-1">Campos con diferencias — marcá los que querés actualizar:</p>
              {camposDiferentes.map(c => {
                const sel = (camposSeleccionados[dup.nuevo.dni] || []).includes(c.key);
                return (
                  <label key={c.key} className="flex items-center gap-2.5 p-2 rounded hover:bg-muted cursor-pointer">
                    <Checkbox checked={sel} onCheckedChange={() => onToggleCampo(dup.nuevo.dni, c.key)} />
                    <span className="font-medium w-28 flex-shrink-0">{c.label}:</span>
                    <span className="text-red-400 line-through truncate max-w-[120px]">{dup.existente[c.key] || '—'}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span className="text-green-600 truncate max-w-[120px]">{dup.nuevo[c.key]}</span>
                  </label>
                );
              })}
              {camposIguales.length > 0 && (
                <p className="text-muted-foreground mt-1">{camposIguales.length} campo(s) sin cambios.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ImportBeneficiariosDialog({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('upload'); // 'upload' | 'duplicados' | 'nuevos' | 'confirmar'

  // Datos extraídos
  const [nuevos, setNuevos] = useState([]); // personas que no existen en la DB
  const [duplicados, setDuplicados] = useState([]); // [{nuevo, existente}]

  // Selección de nuevos a importar
  const [selNuevos, setSelNuevos] = useState(new Set());

  // Para duplicados: por DNI, lista de campos a actualizar
  const [camposAActualizar, setCamposAActualizar] = useState({}); // {dni: [campo1, campo2, ...]}

  const queryClient = useQueryClient();

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Tenés un archivo Excel de un grupo scout con las siguientes columnas: Tipo Documento, Documento (DNI), Nombre, Sexo, Fecha Nacimiento, Provincia, Localidad, Calle, Codigo Postal, Estado Civil, Telefono, Email, Religion, Religion Descripcion, Estudios, Titulo, Empresa, Discapacidad, Detalle Discapacidad, Nacionalidad, Funcion, Categoria, Rama, Zona, Distrito, Código, Organismo, Fecha Primer Afiliacion.
Extraé TODAS las filas de datos (ignorá la fila de encabezados).
Para las fechas (Fecha Nacimiento y Fecha Primer Afiliacion), convertilas EXACTAMENTE al formato YYYY-MM-DD, sin alterar el día. Si la celda está vacía, devolvé string vacío.
Devolvé un JSON con el array "personas".`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          personas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nombre: { type: "string" }, dni: { type: "string" },
                telefono_contacto: { type: "string" }, email_contacto: { type: "string" },
                sexo: { type: "string" }, estado_civil: { type: "string" },
                funcion: { type: "string" }, categoria: { type: "string" },
                zona: { type: "string" }, distrito: { type: "string" },
                codigo: { type: "string" }, organismo: { type: "string" },
                fecha_nacimiento: { type: "string" }, religion: { type: "string" },
                religion_descripcion: { type: "string" }, rama: { type: "string" },
                fecha_primer_afiliacion: { type: "string" },
                provincia: { type: "string" }, localidad: { type: "string" },
                calle: { type: "string" }, codigo_postal: { type: "string" },
                nacionalidad: { type: "string" }, estudios: { type: "string" },
                titulo: { type: "string" }, discapacidad: { type: "string" },
                detalle_discapacidad: { type: "string" },
              }
            }
          }
        }
      }
    });

    if (!result?.personas?.length) {
      toast.error('No se pudieron extraer los datos. Verificá el formato.');
      setLoading(false);
      return;
    }

    const enriched = result.personas.map(p => {
      const fecha = parseFecha(p.fecha_nacimiento);
      const fechaAfil = parseFecha(p.fecha_primer_afiliacion);
      const ramaCalculada = p.rama || ramaDesdeEdad(fecha);
      const tipo = ramaCalculada === 'Voluntario' ? 'Voluntario' : 'Beneficiario';
      return {
        ...p,
        fecha_nacimiento: fecha,
        fecha_primer_afiliacion: fechaAfil || '',
        rama: ramaCalculada,
        tipo,
        activo: true,
        becado: false,
      };
    });

    const existentes = await base44.entities.Beneficiario.list();
    const mapDni = {};
    existentes.forEach(b => { if (b.dni) mapDni[b.dni.toString().trim()] = b; });

    const dups = [];
    const nuevosArr = [];
    enriched.forEach(p => {
      const dniKey = p.dni?.toString().trim();
      if (dniKey && mapDni[dniKey]) {
        dups.push({ nuevo: p, existente: mapDni[dniKey] });
      } else {
        nuevosArr.push(p);
      }
    });

    setDuplicados(dups);
    setNuevos(nuevosArr);
    setSelNuevos(new Set(nuevosArr.map((_, i) => i)));

    // Inicializar: por defecto NO actualizar ningún campo
    const campos = {};
    dups.forEach(d => { campos[d.nuevo.dni] = []; });
    setCamposAActualizar(campos);

    setLoading(false);
    setStep(dups.length > 0 ? 'duplicados' : 'nuevos');
  };

  const toggleCampo = (dni, campo) => {
    setCamposAActualizar(prev => {
      const actual = prev[dni] || [];
      const nuevo = actual.includes(campo) ? actual.filter(c => c !== campo) : [...actual, campo];
      return { ...prev, [dni]: nuevo };
    });
  };

  const seleccionarTodosDup = (dni, campos) => {
    setCamposAActualizar(prev => ({ ...prev, [dni]: campos.map(c => c.key) }));
  };

  const mantenerTodoDup = (dni) => {
    setCamposAActualizar(prev => ({ ...prev, [dni]: [] }));
  };

  const handleImport = async () => {
    setLoading(true);

    // Crear nuevos seleccionados
    const nuevosAImportar = nuevos.filter((_, i) => selNuevos.has(i));
    if (nuevosAImportar.length > 0) {
      await base44.entities.Beneficiario.bulkCreate(nuevosAImportar);
    }

    // Actualizar duplicados campo a campo
    for (const dup of duplicados) {
      const campos = camposAActualizar[dup.nuevo.dni] || [];
      if (campos.length > 0) {
        const update = {};
        campos.forEach(c => { update[c] = dup.nuevo[c]; });
        await base44.entities.Beneficiario.update(dup.existente.id, update);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });

    const actualizados = duplicados.filter(d => (camposAActualizar[d.nuevo.dni] || []).length > 0).length;
    let msg = `${nuevosAImportar.length} nuevos importados`;
    if (actualizados > 0) msg += ` · ${actualizados} actualizados`;
    toast.success(msg);
    setLoading(false);
    onClose();
  };

  // Resumen para confirmar
  const totalNuevosImportar = selNuevos.size;
  const totalActualizar = duplicados.filter(d => (camposAActualizar[d.nuevo.dni] || []).length > 0).length;
  const totalCamposActualizar = duplicados.reduce((s, d) => s + (camposAActualizar[d.nuevo.dni] || []).length, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar desde Excel</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">

          {/* STEP: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <p className="font-medium">Columnas esperadas:</p>
                <p className="text-muted-foreground font-mono text-xs leading-relaxed">
                  Tipo Documento · Documento · Nombre · Sexo · Fecha Nacimiento · Provincia · Localidad · Calle · Codigo Postal · Estado Civil · Telefono · Email · Religion · Religion Descripcion · Estudios · Titulo · Empresa · Discapacidad · Detalle Discapacidad · Nacionalidad · Funcion · Categoria · Rama · Zona · Distrito · Código · Organismo · Fecha Primer Afiliacion
                </p>
              </div>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files[0])} className="hidden" id="import-file" />
                <label htmlFor="import-file" className="cursor-pointer">
                  <p className="text-sm font-medium text-primary">Seleccionar archivo Excel o CSV</p>
                  <p className="text-xs text-muted-foreground mt-1">Se detectarán automáticamente duplicados por DNI</p>
                </label>
                {file && <p className="text-sm mt-3 font-medium">{file.name}</p>}
              </div>
            </div>
          )}

          {/* STEP: DUPLICADOS */}
          {step === 'duplicados' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <strong>{duplicados.length}</strong> personas ya existen (mismo DNI). Expandí cada una para elegir qué campos actualizar.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const todos = {};
                    duplicados.forEach(d => {
                      todos[d.nuevo.dni] = CAMPOS_COMPARACION
                        .filter(c => (d.nuevo[c.key] || '') !== (d.existente[c.key] || '') && (d.nuevo[c.key] || '') !== '')
                        .map(c => c.key);
                    });
                    setCamposAActualizar(todos);
                  }}
                  className="text-xs text-primary hover:underline"
                >Actualizar todos los campos diferentes</button>
                <span className="text-muted-foreground text-xs">·</span>
                <button
                  onClick={() => {
                    const ninguno = {};
                    duplicados.forEach(d => { ninguno[d.nuevo.dni] = []; });
                    setCamposAActualizar(ninguno);
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >Ignorar todos</button>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {duplicados.map((dup, i) => (
                  <DuplicadoCard
                    key={i}
                    dup={dup}
                    camposSeleccionados={camposAActualizar}
                    onToggleCampo={toggleCampo}
                    onSeleccionarTodo={seleccionarTodosDup}
                    onMantenerTodo={mantenerTodoDup}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP: NUEVOS */}
          {step === 'nuevos' && (
            <div className="space-y-3">
              {nuevos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                  No hay personas nuevas — solo duplicados a actualizar.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      {nuevos.length} personas nuevas — seleccioná cuáles importar
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setSelNuevos(new Set(nuevos.map((_, i) => i)))} className="text-xs text-primary hover:underline">Todos</button>
                      <span className="text-muted-foreground text-xs">·</span>
                      <button onClick={() => setSelNuevos(new Set())} className="text-xs text-muted-foreground hover:underline">Ninguno</button>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
                    {nuevos.map((p, i) => (
                      <label key={i} className={cn('flex items-center gap-3 p-2.5 cursor-pointer hover:bg-muted/50 border-b last:border-0', !selNuevos.has(i) && 'opacity-50')}>
                        <Checkbox
                          checked={selNuevos.has(i)}
                          onCheckedChange={() => setSelNuevos(prev => {
                            const next = new Set(prev);
                            next.has(i) ? next.delete(i) : next.add(i);
                            return next;
                          })}
                        />
                        <span className="font-medium text-sm flex-1 truncate">{p.nombre}</span>
                        <span className="text-xs text-muted-foreground">{p.dni}</span>
                        <div className="flex gap-1 flex-shrink-0">
                          {p.rama && <Badge variant="outline" className="text-xs">{p.rama}</Badge>}
                          <Badge className={cn('text-xs border', p.tipo === 'Voluntario' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200')}>
                            {p.tipo}
                          </Badge>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* STEP: CONFIRMAR */}
          {step === 'confirmar' && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 space-y-2">
                <p className="font-semibold text-green-800">Resumen de la importación</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>{totalNuevosImportar} persona(s) nueva(s) a importar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-amber-600" />
                    <span>{totalActualizar} persona(s) a actualizar ({totalCamposActualizar} campos)</span>
                  </div>
                </div>
                {duplicados.length - totalActualizar > 0 && (
                  <p className="text-xs text-muted-foreground">{duplicados.length - totalActualizar} duplicados serán ignorados.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>

          {step === 'upload' && (
            <Button onClick={handleUpload} disabled={!file || loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando...</> : 'Analizar archivo'}
            </Button>
          )}

          {step === 'duplicados' && (
            <Button onClick={() => setStep('nuevos')}>
              Continuar ({nuevos.length} nuevos) →
            </Button>
          )}

          {step === 'nuevos' && (
            <div className="flex gap-2">
              {duplicados.length > 0 && (
                <Button variant="outline" onClick={() => setStep('duplicados')}>← Duplicados</Button>
              )}
              <Button onClick={() => setStep('confirmar')}>
                Confirmar →
              </Button>
            </div>
          )}

          {step === 'confirmar' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('nuevos')}>← Volver</Button>
              <Button onClick={handleImport} disabled={loading || (totalNuevosImportar === 0 && totalActualizar === 0)}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Importar
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}