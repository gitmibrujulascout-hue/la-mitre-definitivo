import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportBeneficiariosDialog({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const queryClient = useQueryClient();

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          beneficiarios: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nombre: { type: "string" },
                dni: { type: "string" },
                fecha_nacimiento: { type: "string" },
                rama: { type: "string", enum: ["Lobatos", "Tropa", "KM", "Rovers"] },
                email_contacto: { type: "string" },
                telefono_contacto: { type: "string" },
              }
            }
          }
        }
      }
    });
    if (result.status === 'success' && result.output?.beneficiarios) {
      setExtractedData(result.output.beneficiarios);
    } else {
      toast.error('No se pudieron extraer los datos');
    }
    setLoading(false);
  };

  const handleImport = async () => {
    if (!extractedData?.length) return;
    setLoading(true);
    const records = extractedData.map(b => ({
      ...b,
      activo: true,
      becado: false
    }));
    await base44.entities.Beneficiario.bulkCreate(records);
    queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
    toast.success(`${records.length} beneficiarios importados`);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Beneficiarios</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {!extractedData ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Subí un archivo Excel, CSV o PDF con el listado de beneficiarios. El sistema extraerá los datos automáticamente.
              </p>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png"
                  onChange={e => setFile(e.target.files[0])}
                  className="hidden"
                  id="import-file"
                />
                <label htmlFor="import-file" className="cursor-pointer">
                  <p className="text-sm font-medium text-primary">Seleccionar archivo</p>
                  <p className="text-xs text-muted-foreground mt-1">CSV, Excel, PDF o imagen</p>
                </label>
                {file && <p className="text-sm mt-3 font-medium">{file.name}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Se encontraron {extractedData.length} beneficiarios:</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {extractedData.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-muted text-sm">
                    <span className="font-medium">{b.nombre}</span>
                    <span className="text-muted-foreground">{b.rama}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {!extractedData ? (
            <Button onClick={handleUpload} disabled={!file || loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Analizar archivo
            </Button>
          ) : (
            <Button onClick={handleImport} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Importar {extractedData.length} beneficiarios
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}