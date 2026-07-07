import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, CheckCircle2, Sparkles, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const CATEGORIAS = ['Materiales', 'Alimentos', 'Transporte', 'Servicios', 'Mantenimiento', 'Campamento', 'Otro'];

export default function ImportMasivaGastosDialog({ open, onClose }) {
  const [archivos, setArchivos] = useState([]);
  const [procesados, setProcesados] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const queryClient = useQueryClient();

  const handleFiles = (e) => {
    const nuevos = Array.from(e.target.files);
    setArchivos(prev => [...prev, ...nuevos]);
  };

  const removerArchivo = (idx) => setArchivos(prev => prev.filter((_, i) => i !== idx));

  const procesarTodos = async () => {
    if (!archivos.length) return;
    setProcesando(true);
    setProgreso(0);
    const resultados = [];

    for (let i = 0; i < archivos.length; i++) {
      const file = archivos[i];
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              descripcion: { type: "string" },
              monto_total: { type: "number" },
              fecha: { type: "string", description: "YYYY-MM-DD" },
              proveedor: { type: "string" },
              numero_factura: { type: "string" },
              categoria: { type: "string", enum: CATEGORIAS }
            }
          }
        });
        if (result.status === 'success' && result.output) {
          const d = result.output;
          resultados.push({
            archivo: file.name,
            descripcion: d.descripcion || file.name,
            monto: d.monto_total || 0,
            fecha: d.fecha || new Date().toISOString().split('T')[0],
            proveedor: d.proveedor || '',
            numero_factura: d.numero_factura || '',
            categoria: d.categoria || 'Otro',
            archivo_url: file_url,
            ok: true,
            forma_pago: 'Efectivo',
          });
        } else {
          resultados.push({ archivo: file.name, ok: false, descripcion: file.name, monto: 0, fecha: new Date().toISOString().split('T')[0], categoria: 'Otro' });
        }
      } catch {
        resultados.push({ archivo: file.name, ok: false, descripcion: file.name, monto: 0, fecha: new Date().toISOString().split('T')[0], categoria: 'Otro' });
      }
      setProgreso(Math.round(((i + 1) / archivos.length) * 100));
    }
    setProcesados(resultados);
    setProcesando(false);
  };

  const actualizarCampo = (idx, campo, valor) => {
    setProcesados(prev => prev.map((p, i) => i === idx ? { ...p, [campo]: valor } : p));
  };

  const importarTodos = async () => {
    setProcesando(true);
    const gastosAImportar = procesados.filter(p => !p.duplicado);
    const gastos = gastosAImportar.map(p => ({
      descripcion: p.descripcion,
      monto: parseFloat(p.monto) || 0,
      fecha: p.fecha,
      proveedor: p.proveedor,
      numero_factura: p.numero_factura,
      categoria: p.categoria,
      archivo_url: p.archivo_url || '',
      forma_pago: p.forma_pago || '',
      destino: p.destino || '',
    }));
    await base44.entities.Gasto.bulkCreate(gastos);
    queryClient.invalidateQueries({ queryKey: ['gastos'] });
    toast.success(`${gastos.length} gastos importados correctamente`);
    setProcesando(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carga masiva de gastos</DialogTitle>
        </DialogHeader>

        {procesados.length === 0 ? (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleFiles}
                className="hidden"
                id="bulk-gasto-files"
              />
              <label htmlFor="bulk-gasto-files" className="cursor-pointer">
                <p className="text-sm font-medium text-primary">Seleccionar facturas/recibos</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG o PNG — podés seleccionar múltiples archivos</p>
              </label>
            </div>

            {archivos.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{archivos.length} archivo(s) seleccionado(s):</p>
                {archivos.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-muted text-sm">
                    <span className="truncate">{f.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removerArchivo(i)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {procesando && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando con IA... {progreso}%
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progreso}%` }} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">Revisá y corregí los datos extraídos antes de importar:</p>
            {procesados.map((p, i) => (
              <div key={i} className={`p-3 rounded-lg border ${p.ok ? 'border-green-200 bg-green-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                <p className="text-xs font-semibold text-muted-foreground mb-2 truncate">{p.archivo}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Descripción</Label>
                    <Input className="h-7 text-xs" value={p.descripcion} onChange={e => actualizarCampo(i, 'descripcion', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Monto</Label>
                    <Input className="h-7 text-xs" type="number" value={p.monto} onChange={e => actualizarCampo(i, 'monto', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Fecha</Label>
                    <Input className="h-7 text-xs" type="date" value={p.fecha} onChange={e => actualizarCampo(i, 'fecha', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Proveedor</Label>
                    <Input className="h-7 text-xs" value={p.proveedor} onChange={e => actualizarCampo(i, 'proveedor', e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Categoría</Label>
                    <select
                      className="w-full h-7 text-xs border border-input rounded-md px-2 bg-background"
                      value={p.categoria}
                      onChange={e => actualizarCampo(i, 'categoria', e.target.value)}
                    >
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Forma de pago</Label>
                    <select
                      className="w-full h-7 text-xs border border-input rounded-md px-2 bg-background"
                      value={p.forma_pago || 'Efectivo'}
                      onChange={e => actualizarCampo(i, 'forma_pago', e.target.value)}
                    >
                      <option value="">Sin especificar</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Débito desde</Label>
                    <select
                      className="w-full h-7 text-xs border border-input rounded-md px-2 bg-background"
                      value={p.destino || ''}
                      onChange={e => actualizarCampo(i, 'destino', e.target.value)}
                    >
                      <option value="">Sin especificar</option>
                      <option value="Caja">Caja</option>
                      <option value="Banco">Banco</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {procesados.length === 0 ? (
            <Button onClick={procesarTodos} disabled={!archivos.length || procesando}>
              {procesando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Analizar con IA
            </Button>
          ) : (
            <Button onClick={importarTodos} disabled={procesando}>
              {procesando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Importar {procesados.length} gastos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}