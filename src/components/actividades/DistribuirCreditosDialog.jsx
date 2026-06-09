import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatMoney } from '@/lib/ramaUtils';
import { RefreshCw } from 'lucide-react';

function roundTo500(value) {
  return Math.round(value / 500) * 500;
}

export default function DistribuirCreditosDialog({ open, onClose, onSaved, actividad, ventas, gananciaReal, beneficiarios }) {
  const queryClient = useQueryClient();
  const pctBen = actividad.porcentaje_beneficiario || 50;
  const totalVentas = ventas.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
  const gananciaParaBen = Math.max(0, gananciaReal) * pctBen / 100;

  const calculados = useMemo(() => {
    return ventas.map(v => {
      const ben = beneficiarios.find(b => b.id === v.beneficiario_id);
      const proporcion = totalVentas > 0 ? v.monto_recaudado / totalVentas : 0;
      const creditoExacto = Math.round(gananciaParaBen * proporcion * 100) / 100;
      const creditoSugerido = roundTo500(creditoExacto);
      return { v, ben, creditoExacto, creditoSugerido, proporcion };
    })
    .filter(d => d.creditoExacto > 0)
    .sort((a, b) => {
      const na = (a.ben?.nombre || a.v.beneficiario_nombre || '').toLowerCase();
      const nb = (b.ben?.nombre || b.v.beneficiario_nombre || '').toLowerCase();
      return na.localeCompare(nb, 'es');
    });
  }, [ventas, gananciaParaBen, totalVentas, beneficiarios]);

  // Estado editable: monto final por beneficiario (id -> monto)
  const [montos, setMontos] = useState({});

  // Inicializar montos con valores redondeados cuando cambian los calculados
  useMemo(() => {
    const init = {};
    calculados.forEach(d => { init[d.v.id] = d.creditoSugerido; });
    setMontos(init);
  }, [calculados.length, gananciaReal]);

  const getMonto = (id) => montos[id] ?? 0;
  const setMonto = (id, val) => setMontos(prev => ({ ...prev, [id]: val === '' ? '' : Number(val) }));
  const resetMonto = (id, sugerido) => setMontos(prev => ({ ...prev, [id]: sugerido }));

  const totalADistribuir = calculados.reduce((s, d) => s + (getMonto(d.v.id) || 0), 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const fecha = new Date().toISOString().split('T')[0];
      await Promise.all(calculados.map(d => {
        const monto = getMonto(d.v.id) || 0;
        if (monto <= 0) return Promise.resolve();
        return base44.entities.CreditoBeneficiario.create({
          beneficiario_id: d.v.beneficiario_id,
          beneficiario_nombre: d.ben?.nombre || d.v.beneficiario_nombre,
          actividad_id: actividad.id,
          actividad_nombre: actividad.nombre,
          monto_original: monto,
          monto_disponible: monto,
          fecha,
        });
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditos'] });
      toast.success('Créditos distribuidos correctamente');
      onSaved();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
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

          {calculados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay ganancia para distribuir o no hay ventas registradas.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-sm font-medium">Crédito a acreditar a cada participante:</p>
                <p className="text-xs text-muted-foreground">
                  Los valores están redondeados a $500 para simplificar. Podés ajustar cada monto manualmente.
                </p>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {calculados.map(({ v, ben, creditoExacto, creditoSugerido, proporcion }) => (
                  <div key={v.id} className="bg-muted/30 rounded-lg px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{ben?.nombre || v.beneficiario_nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(v.monto_recaudado)} vendidos · {Math.round(proporcion * 100)}% · Exacto: {formatMoney(creditoExacto)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-16 flex-shrink-0">Acreditar:</span>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="500"
                          min="0"
                          value={getMonto(v.id)}
                          onChange={e => setMonto(v.id, e.target.value)}
                          className="pl-6 h-8 text-sm font-semibold text-primary"
                        />
                      </div>
                      {getMonto(v.id) !== creditoSugerido && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          title="Restaurar valor redondeado"
                          onClick={() => resetMonto(v.id, creditoSugerido)}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total a distribuir</span>
                <span className="font-bold text-primary">{formatMoney(totalADistribuir)}</span>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Estos créditos quedarán disponibles en la cuenta corriente de cada beneficiario.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={calculados.length === 0 || mutation.isPending || totalADistribuir <= 0}
          >
            Confirmar y acreditar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}