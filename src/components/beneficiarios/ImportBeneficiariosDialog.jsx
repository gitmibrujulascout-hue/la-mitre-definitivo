import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2, CheckCircle2, Users, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { ramaDesdeEdad } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';

export default function ImportBeneficiariosDialog({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const queryClient = useQueryClient();

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Tenés un archivo Excel de un grupo scout con las columnas: DNI, Nombre, Teléfono, Función, Categoría, Zona, Distrito, Código, Organismo, Fecha de Nacimiento, Religión, Religion Descripcion.
Extraé TODAS las filas de datos (ignorá la fila de encabezados).
Para la fecha de nacimiento, convertila al formato YYYY-MM-DD.
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
                  nombre:               { type: "string" },
                  dni:                  { type: "string" },
                  telefono_contacto:    { type: "string" },
                  funcion:              { type: "string" },
                  categoria:            { type: "string" },
                  zona:                 { type: "string" },
                  distrito:             { type: "string" },
                  codigo:               { type: "string" },
                  organismo:            { type: "string" },
                  fecha_nacimiento:     { type: "string" },
                  religion:             { type: "string" },
                  religion_descripcion: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result?.personas?.length > 0) {
        const enriched = result.personas.map(p => {
          const rama = ramaDesdeEdad(p.fecha_nacimiento);
          const tipo = rama === 'Voluntario' ? 'Voluntario' : 'Beneficiario';
          return { ...p, rama, tipo, activo: true, becado: false };
        });
        setExtractedData(enriched);
      } else {
        toast.error('No se pudieron extraer los datos. Verificá el formato del archivo.');
      }
    } catch (e) {
      toast.error('Error al procesar el archivo: ' + (e?.message || 'desconocido'));
    }

    setLoading(false);
  };

  const handleImport = async () => {
    if (!extractedData?.length) return;
    setLoading(true);

    // Obtener beneficiarios existentes para detectar duplicados por DNI
    const existentes = await base44.entities.Beneficiario.list();
    const dnisExistentes = new Set(existentes.map(b => b.dni?.toString().trim()).filter(Boolean));

    const nuevos = extractedData.filter(p => !p.dni || !dnisExistentes.has(p.dni?.toString().trim()));
    const duplicados = extractedData.filter(p => p.dni && dnisExistentes.has(p.dni?.toString().trim()));

    if (nuevos.length > 0) {
      await base44.entities.Beneficiario.bulkCreate(nuevos);
    }
    queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
    const benefs = nuevos.filter(p => p.tipo === 'Beneficiario').length;
    const vols = nuevos.filter(p => p.tipo === 'Voluntario').length;
    const msg = duplicados.length > 0
      ? `Importados: ${benefs} benef. y ${vols} vol. | Omitidos ${duplicados.length} duplicados por DNI`
      : `Importados: ${benefs} beneficiarios y ${vols} voluntarios`;
    toast.success(msg);
    setLoading(false);
    onClose();
  };

  const beneficiarios = extractedData?.filter(p => p.tipo === 'Beneficiario') || [];
  const voluntarios = extractedData?.filter(p => p.tipo === 'Voluntario') || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar desde Excel</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {!extractedData ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <p className="font-medium">Columnas esperadas en el archivo:</p>
                <p className="text-muted-foreground font-mono text-xs">
                  DNI · Nombre · Teléfono · Función · Categoría · Zona · Distrito · Código · Organismo · Fecha de Nacimiento · Religión · Religion Descripcion
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
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center">
                  <Users className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-blue-700">{beneficiarios.length}</p>
                  <p className="text-xs text-blue-600">Beneficiarios</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-center">
                  <UserCog className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-purple-700">{voluntarios.length}</p>
                  <p className="text-xs text-purple-600">Voluntarios/Educadores</p>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
                {extractedData.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded hover:bg-muted text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{p.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {p.rama && (
                        <Badge variant="secondary" className="text-xs">{p.rama}</Badge>
                      )}
                      <Badge className={p.tipo === 'Voluntario' ? 'bg-purple-100 text-purple-700 border-purple-200 border text-xs' : 'bg-blue-100 text-blue-700 border-blue-200 border text-xs'}>
                        {p.tipo}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                ✓ La rama y el tipo se asignaron automáticamente según la fecha de nacimiento. Podés editarlos después individualmente.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {!extractedData ? (
            <Button onClick={handleUpload} disabled={!file || loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando (puede tardar ~30s)...</> : 'Analizar archivo'}
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Importar {extractedData.length} personas
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}