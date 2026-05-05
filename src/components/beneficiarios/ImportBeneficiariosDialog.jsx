import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2, CheckCircle2, Users, UserCog, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ramaDesdeEdad } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';

// Corrige el problema de timezone: convierte "YYYY-MM-DD" a fecha local sin restar un día
function parseFechaNacimiento(str) {
  if (!str) return '';
  // Si ya tiene formato YYYY-MM-DD, devolver tal cual (no usar new Date() que convierte a UTC)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Intentar parsear formatos comunes
  const d = new Date(str);
  if (isNaN(d)) return str;
  // Usar UTC para evitar corrimiento de día
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ImportBeneficiariosDialog({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [duplicados, setDuplicados] = useState([]); // [{nuevo, existente}]
  const [resolucionesDup, setResolucionesDup] = useState({}); // {dni: 'mantener'|'actualizar'}
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'duplicados'
  const queryClient = useQueryClient();

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Tenés un archivo Excel de un grupo scout con las siguientes columnas: Tipo Documento, Documento (DNI), Nombre, Sexo, Fecha Nacimiento, Provincia, Localidad, Calle, Codigo Postal, Estado Civil, Telefono, Email, Religion, Religion Descripcion, Estudios, Titulo, Empresa, Discapacidad, Detalle Discapacidad, Nacionalidad, Funcion, Categoria, Rama, Zona, Distrito, Código, Organismo, Fecha Primer Afiliacion.
Extraé TODAS las filas de datos (ignorá la fila de encabezados).
Para las fechas (Fecha Nacimiento y Fecha Primer Afiliacion), convertilas EXACTAMENTE al formato YYYY-MM-DD, sin alterar el día. No le restes ni sumes días. Si la fecha original es 15/03/2010, devolvé 2010-03-15. Si la celda está vacía, devolvé null o string vacío.
Devolvé un JSON con el array "personas" con todos los campos de cada persona.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            personas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nombre: { type: "string" },
                  dni: { type: "string" },
                  telefono_contacto: { type: "string" },
                  email_contacto: { type: "string" },
                  funcion: { type: "string" },
                  categoria: { type: "string" },
                  zona: { type: "string" },
                  distrito: { type: "string" },
                  codigo: { type: "string" },
                  organismo: { type: "string" },
                  fecha_nacimiento: { type: "string" },
                  religion: { type: "string" },
                  religion_descripcion: { type: "string" },
                  rama: { type: "string" },
                  fecha_primer_afiliacion: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result?.personas?.length > 0) {
        const enriched = result.personas.map(p => {
          const fecha = parseFechaNacimiento(p.fecha_nacimiento);
          const fechaPrimeraAfiliacion = parseFechaNacimiento(p.fecha_primer_afiliacion);
          // Usar rama del archivo si viene, sino calcular por edad
          const ramaCalculada = p.rama || ramaDesdeEdad(fecha);
          const tipo = ramaCalculada === 'Voluntario' ? 'Voluntario' : 'Beneficiario';
          const obj = {
            ...p,
            fecha_nacimiento: fecha,
            rama: ramaCalculada,
            tipo,
            activo: true,
            becado: false,
          };
          if (fechaPrimeraAfiliacion) obj.fecha_primer_afiliacion = fechaPrimeraAfiliacion;
          return obj;
        });

        // Detectar duplicados
        const existentes = await base44.entities.Beneficiario.list();
        const mapDni = {};
        existentes.forEach(b => { if (b.dni) mapDni[b.dni.toString().trim()] = b; });

        const dups = [];
        const nuevos = [];
        enriched.forEach(p => {
          const dniKey = p.dni?.toString().trim();
          if (dniKey && mapDni[dniKey]) {
            dups.push({ nuevo: p, existente: mapDni[dniKey] });
          } else {
            nuevos.push(p);
          }
        });

        setExtractedData(nuevos);
        setDuplicados(dups);

        // Inicializar resoluciones: por defecto mantener el existente
        const res = {};
        dups.forEach(d => { res[d.nuevo.dni] = 'mantener'; });
        setResolucionesDup(res);

        setStep(dups.length > 0 ? 'duplicados' : 'preview');
      } else {
        toast.error('No se pudieron extraer los datos. Verificá el formato del archivo.');
      }
    } catch (e) {
      toast.error('Error al procesar el archivo: ' + (e?.message || 'desconocido'));
    }
    setLoading(false);
  };

  const handleImport = async () => {
    if (!extractedData) return;
    setLoading(true);

    // Importar nuevos
    if (extractedData.length > 0) {
      await base44.entities.Beneficiario.bulkCreate(extractedData);
    }

    // Procesar duplicados según resolución
    for (const dup of duplicados) {
      const res = resolucionesDup[dup.nuevo.dni];
      if (res === 'actualizar') {
        await base44.entities.Beneficiario.update(dup.existente.id, dup.nuevo);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
    const actualizados = duplicados.filter(d => resolucionesDup[d.nuevo.dni] === 'actualizar').length;
    const mantenidos = duplicados.filter(d => resolucionesDup[d.nuevo.dni] === 'mantener').length;
    let msg = `Importados: ${extractedData.length} nuevos`;
    if (actualizados > 0) msg += ` | ${actualizados} actualizados`;
    if (mantenidos > 0) msg += ` | ${mantenidos} omitidos (duplicado)`;
    toast.success(msg);
    setLoading(false);
    onClose();
  };

  const beneficiariosList = extractedData?.filter(p => p.tipo === 'Beneficiario') || [];
  const voluntariosList = extractedData?.filter(p => p.tipo === 'Voluntario') || [];
  const totalNuevos = (extractedData?.length || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar desde Excel</DialogTitle>
        </DialogHeader>
        <div className="py-4">

          {step === 'upload' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <p className="font-medium">Columnas esperadas en el archivo:</p>
                <p className="text-muted-foreground font-mono text-xs">
                  Tipo Documento · Documento · Nombre · Sexo · Fecha Nacimiento · Provincia · Localidad · Calle · Codigo Postal · Estado Civil · Telefono · Email · Religion · Religion Descripcion · Estudios · Titulo · Empresa · Discapacidad · Detalle Discapacidad · Nacionalidad · Funcion · Categoria · Rama · Zona · Distrito · Código · Organismo · Fecha Primer Afiliacion
                </p>
              </div>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={e => setFile(e.target.files[0])}
                  className="hidden"
                  id="import-file"
                />
                <label htmlFor="import-file" className="cursor-pointer">
                  <p className="text-sm font-medium text-primary">Seleccionar archivo Excel o CSV</p>
                  <p className="text-xs text-muted-foreground mt-1">Los voluntarios (22+ años) se detectan automáticamente</p>
                </label>
                {file && <p className="text-sm mt-3 font-medium text-foreground">{file.name}</p>}
              </div>
            </div>
          )}

          {step === 'duplicados' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">Se encontraron <strong>{duplicados.length}</strong> personas que ya existen en el sistema (mismo DNI). Indicá qué hacer con cada una:</p>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2 border rounded-lg p-2">
                {duplicados.map((dup, i) => {
                  const res = resolucionesDup[dup.nuevo.dni] || 'mantener';
                  return (
                    <div key={i} className="p-3 rounded-lg border bg-muted/30 text-sm space-y-2">
                      <div className="font-medium">{dup.nuevo.nombre} <span className="text-muted-foreground font-normal">DNI: {dup.nuevo.dni}</span></div>
                      {dup.existente.fecha_nacimiento !== dup.nuevo.fecha_nacimiento && (
                        <div className="text-xs text-muted-foreground">
                          Fecha nacimiento: <span className="text-red-500 line-through">{dup.existente.fecha_nacimiento}</span> → <span className="text-green-600">{dup.nuevo.fecha_nacimiento}</span>
                        </div>
                      )}
                      {dup.existente.nombre !== dup.nuevo.nombre && (
                        <div className="text-xs text-muted-foreground">
                          Nombre: <span className="text-red-500 line-through">{dup.existente.nombre}</span> → <span className="text-green-600">{dup.nuevo.nombre}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          className={`flex-1 text-xs py-1.5 rounded border font-medium transition-colors ${res === 'mantener' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}
                          onClick={() => setResolucionesDup(prev => ({ ...prev, [dup.nuevo.dni]: 'mantener' }))}
                        >
                          Mantener existente
                        </button>
                        <button
                          className={`flex-1 text-xs py-1.5 rounded border font-medium transition-colors ${res === 'actualizar' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}
                          onClick={() => setResolucionesDup(prev => ({ ...prev, [dup.nuevo.dni]: 'actualizar' }))}
                        >
                          Actualizar con nuevo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => {
                const all = {};
                duplicados.forEach(d => { all[d.nuevo.dni] = 'actualizar'; });
                setResolucionesDup(all);
              }}>Actualizar todos</Button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                  <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-blue-700">{beneficiariosList.length}</p>
                  <p className="text-xs text-blue-600">Nuevos beneficiarios</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center">
                  <UserCog className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-purple-700">{voluntariosList.length}</p>
                  <p className="text-xs text-purple-600">Nuevos voluntarios</p>
                </div>
              </div>
              {duplicados.length > 0 && (
                <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  <strong>{duplicados.length}</strong> duplicados resueltos: {duplicados.filter(d => resolucionesDup[d.nuevo.dni] === 'actualizar').length} se actualizarán, {duplicados.filter(d => resolucionesDup[d.nuevo.dni] === 'mantener').length} se omitirán.
                </div>
              )}
              <div className="max-h-52 overflow-y-auto space-y-1 border rounded-lg p-2">
                {extractedData.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm">
                    <span className="font-medium truncate">{p.nombre}</span>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {p.rama && <Badge variant="secondary" className="text-xs">{p.rama}</Badge>}
                      <Badge className={p.tipo === 'Voluntario' ? 'bg-purple-100 text-purple-700 border-purple-200 border text-xs' : 'bg-blue-100 text-blue-700 border-blue-200 border text-xs'}>
                        {p.tipo}
                      </Badge>
                    </div>
                  </div>
                ))}
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
            <Button onClick={() => setStep('preview')}>
              Continuar →
            </Button>
          )}
          {step === 'preview' && (
            <>
              {duplicados.length > 0 && <Button variant="outline" onClick={() => setStep('duplicados')}>← Revisar duplicados</Button>}
              <Button onClick={handleImport} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Importar {totalNuevos + duplicados.filter(d => resolucionesDup[d.nuevo.dni] === 'actualizar').length} personas
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}