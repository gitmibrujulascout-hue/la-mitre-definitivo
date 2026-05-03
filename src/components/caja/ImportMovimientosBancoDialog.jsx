import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, ArrowUpRight, ArrowDownLeft, Loader2 } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

export default function ImportMovimientosBancoDialog({ open, onClose }) {
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [loading, setLoading] = useState(false);
  const [movimientos, setMovimientos] = useState([]);
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extraé todos los movimientos bancarios del siguiente estado de cuenta bancario.
Para cada movimiento devolvé:
- fecha: en formato YYYY-MM-DD
- concepto: descripción del movimiento (campo Concepto del PDF)
- importe: número (positivo si es ingreso, negativo si es egreso)
- tipo: "Ingreso" si importe > 0, "Egreso" si importe < 0
- monto: valor absoluto del importe (siempre positivo)
- nro_referencia: número de referencia

Ignorá los movimientos de tasas bancarias (DBCR TASA GRAL), retenciones (RETENCION ING BRUTOS) y comisiones bancarias internas — esos son gastos bancarios que no corresponde importar.
Incluí transferencias de clientes (TRANSF...), pagos de impuestos (IMP. AFIP), transferencias MacrOnline (Transf. MacrOnline), y cualquier otro movimiento relevante.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            movimientos: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  fecha: { type: 'string' },
                  concepto: { type: 'string' },
                  tipo: { type: 'string' },
                  monto: { type: 'number' },
                  nro_referencia: { type: 'string' },
                }
              }
            }
          }
        }
      });

      setMovimientos(result.movimientos || []);
      setStep('preview');
    } catch (err) {
      toast.error('Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      await Promise.all(
        movimientos.map(m =>
          base44.entities.MovimientoBanco.create({
            fecha: m.fecha,
            tipo: m.tipo,
            concepto: m.concepto,
            monto: m.monto,
            cuenta: 'Banco',
            origen: 'Manual',
            observaciones: m.nro_referencia ? `Ref: ${m.nro_referencia}` : '',
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success(`${movimientos.length} movimientos importados`);
      setStep('done');
    } catch (err) {
      toast.error('Error al importar');
    } finally {
      setLoading(false);
    }
  };

  const ingresos = movimientos.filter(m => m.tipo === 'Ingreso');
  const egresos = movimientos.filter(m => m.tipo === 'Egreso');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar movimientos bancarios</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8">
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Procesando el PDF con IA...</p>
              </div>
            ) : (
              <div
                className="flex flex-col items-center gap-4 border-2 border-dashed border-border rounded-xl p-10 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="w-12 h-12 text-muted-foreground" />
                <div className="text-center">
                  <p className="font-medium">Subir extracto bancario</p>
                  <p className="text-sm text-muted-foreground mt-1">PDF del banco (Macro u otro)</p>
                </div>
                <Button type="button" variant="outline">
                  <Upload className="w-4 h-4 mr-2" />Seleccionar PDF
                </Button>
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600 font-medium">{ingresos.length} ingresos</span>
              <span className="text-red-500 font-medium">{egresos.length} egresos</span>
              <span className="text-muted-foreground">{movimientos.length} total</span>
            </div>

            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{m.fecha}</TableCell>
                      <TableCell className="text-sm">{m.concepto}</TableCell>
                      <TableCell>
                        <Badge className={m.tipo === 'Ingreso'
                          ? 'bg-green-100 text-green-700 border-green-300 border'
                          : 'bg-red-100 text-red-700 border-red-300 border'
                        }>
                          {m.tipo === 'Ingreso' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownLeft className="w-3 h-3 mr-1" />}
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn('text-right font-semibold text-sm', m.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-500')}>
                        {m.tipo === 'Egreso' ? '−' : '+'}{formatMoney(m.monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              Revisá los movimientos antes de importar. Los gastos bancarios (tasas, retenciones) fueron excluidos automáticamente.
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="font-semibold">Importación completa</p>
            <p className="text-sm text-muted-foreground">{movimientos.length} movimientos agregados al Banco</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {step === 'done' ? 'Cerrar' : 'Cancelar'}
          </Button>
          {step === 'preview' && (
            <Button onClick={handleImport} disabled={loading || movimientos.length === 0}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Importar {movimientos.length} movimientos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}