import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/ramaUtils';

export default function DistribuirCreditosDialog({ open, onClose, onSaved, actividad, ventas, gananciaReal, beneficiarios }) {
  const queryClient = useQueryClient();
  const pctBen = actividad.porcentaje_beneficiario || 50;
  const totalVentas = ventas.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
  const gananciaParaBen = Math.max(0, gananciaReal) * pctBen / 100;

  const distribuciones = useMemo(() => {
    return ventas.map(v => {
      const ben = beneficiarios.find(b => b.id === v.beneficiario_id);
      const proporcion = totalVentas > 0 ? v.monto_recaudado / totalVentas : 0;
      const credito = Math.round(gananciaParaBen * proporcion * 100) / 100;
      return { v, ben, credito, proporcion };
    }).filter(d => d.credito > 0);
  }, [ventas, gananciaParaBen, totalVentas, beneficiarios]);

  const mutation = useMutation({
    mutationFn: async () => {
      const fecha = new Date().toISOString().split('T')[0];
      await Promise.all(distribuciones.map(d =>
        base44.entities.CreditoBeneficiario.create({
          beneficiario_id: d.v.beneficiario_id,
          beneficiario_nombre: d.ben?.nombre || d.v.beneficiario_nombre,
          actividad_id: actividad.id,
          actividad_nombre: actividad.nombre,
          monto_original: d.credito,
          monto_disponible: d.credito,
          fecha,
        })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditos'] });
      toast.success('Créditos distribuidos correctamente');
      onSaved();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Distribuir créditos</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Ganancia neta</p>
              <p className="font-bold text-green-600">{formatMoney(Math.max(0, gananciaReal))}</p>
            </div>
            <div className="bg-primary/5 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Para beneficiarios ({pctBen}%)</p>
              <p className="font-bold text-primary">{formatMoney(gananciaParaBen)}</p>
            </div>
          </div>

          {distribuciones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay ganancia para distribuir o no hay ventas registradas.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">Crédito a acreditar a cada participante:</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {distribuciones.map(({ v, ben, credito, proporcion }) => (
                  <div key={v.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                    <div>
                      <p className="font-medium">{ben?.nombre || v.beneficiario_nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(v.monto_recaudado)} vendidos · {Math.round(proporcion * 100)}% del total
                      </p>
                    </div>
                    <p className="font-bold text-primary">{formatMoney(credito)}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Estos créditos quedarán disponibles en la cuenta corriente de cada beneficiario para aplicar a cuotas o campamentos.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={distribuciones.length === 0 || mutation.isPending}
          >
            Confirmar y acreditar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}