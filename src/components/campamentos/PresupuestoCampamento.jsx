import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { formatMoney } from '@/lib/ramaUtils';
import { Calculator, TrendingUp, TrendingDown, Users, Calendar, Utensils, Bus, Truck, MapPin, Package, Pill, Plus, AlertTriangle } from 'lucide-react';

const DEFAULT_ITEMS = [
  { id: 'comida', label: 'Comida', icon: Utensils, perPersonPerDay: true, splitWithAdults: true },
  { id: 'transporte', label: 'Transporte', icon: Bus, perPersonPerDay: false, splitWithAdults: true },
  { id: 'flete', label: 'Flete / Traslado', icon: Truck, perPersonPerDay: false, splitWithAdults: true },
  { id: 'alojamiento', label: 'Alojamiento / Lugar', icon: MapPin, perPersonPerDay: false, splitWithAdults: true },
  { id: 'materiales', label: 'Materiales', icon: Package, perPersonPerDay: false, splitWithAdults: false },
  { id: 'medicamentos', label: 'Medicamentos', icon: Pill, perPersonPerDay: false, splitWithAdults: false },
  { id: 'extras', label: 'Extras', icon: Plus, perPersonPerDay: false, splitWithAdults: false },
  { id: 'imprevistos', label: 'Reserva imprevistos', icon: AlertTriangle, perPersonPerDay: false, splitWithAdults: true },
];

export default function PresupuestoCampamento({ open, onClose, campamento }) {
  const [comidaPorPersonaDia, setComidaPorPersonaDia] = useState('');
  const [itemValues, setItemValues] = useState({});
  const [itemSplits, setItemSplits] = useState(() =>
    Object.fromEntries(DEFAULT_ITEMS.map(i => [i.id, i.splitWithAdults]))
  );

  const beneficiariosCamp = (campamento?.beneficiarios_ids || []).length;
  const adultosCamp = (campamento?.adultos_ids || []).length;
  const totalPersonas = beneficiariosCamp + adultosCamp;

  const dias = useMemo(() => {
    if (!campamento?.fecha_inicio || !campamento?.fecha_fin) return 0;
    const ini = new Date(campamento.fecha_inicio + 'T12:00:00');
    const fin = new Date(campamento.fecha_fin + 'T12:00:00');
    const diff = Math.ceil((fin - ini) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }, [campamento]);

  const comidaTotal = (parseFloat(comidaPorPersonaDia) || 0) * totalPersonas * dias;

  const itemTotals = useMemo(() => {
    const totals = {};
    for (const item of DEFAULT_ITEMS) {
      totals[item.id] = item.perPersonPerDay ? comidaTotal : (parseFloat(itemValues[item.id]) || 0);
    }
    return totals;
  }, [comidaTotal, itemValues]);

  const costoTotalEstimado = Object.values(itemTotals).reduce((s, v) => s + v, 0);

  // Costo por beneficiario: items divididos con adultos usan totalPersonas, el resto solo beneficiarios
  const costoPorBeneficiario = useMemo(() => {
    if (beneficiariosCamp === 0) return 0;
    let totalBen = 0;
    for (const item of DEFAULT_ITEMS) {
      const val = itemTotals[item.id];
      const divisors = itemSplits[item.id] ? totalPersonas : beneficiariosCamp;
      if (divisors > 0) totalBen += (val / divisors) * beneficiariosCamp;
    }
    return totalBen / beneficiariosCamp;
  }, [itemTotals, itemSplits, totalPersonas, beneficiariosCamp]);

  const ingresoBeneficiarios = beneficiariosCamp * (campamento?.costo_por_persona || 0);
  const ingresoAdultos = campamento?.adultos_pagan
    ? adultosCamp * (campamento?.costo_adultos || campamento?.costo_por_persona || 0)
    : 0;
  const ingresoTotal = ingresoBeneficiarios + ingresoAdultos;
  const resultado = ingresoTotal - costoTotalEstimado;

  const rows = DEFAULT_ITEMS.map(item => ({
    ...item,
    value: itemTotals[item.id],
    detail: item.perPersonPerDay && dias > 0 && totalPersonas > 0 && comidaPorPersonaDia
      ? `${formatMoney(parseFloat(comidaPorPersonaDia) || 0)} × ${totalPersonas} pers × ${dias} días`
      : null,
    split: itemSplits[item.id],
    divisors: itemSplits[item.id] ? totalPersonas : beneficiariosCamp,
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            Presupuesto — {campamento?.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Resumen del campamento */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-lg p-2.5">
              <Users className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold">{totalPersonas}</p>
              <p className="text-xs text-muted-foreground">{beneficiariosCamp} ben. + {adultosCamp} adult.</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5">
              <Calendar className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-lg font-bold">{dias}</p>
              <p className="text-xs text-muted-foreground">días</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
              <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-sm font-bold text-green-700">{formatMoney(ingresoTotal)}</p>
              <p className="text-xs text-muted-foreground">Ingreso esp.</p>
            </div>
          </div>

          {/* Inputs de gastos estimados */}
          <div className="space-y-3">
            {/* Comida (per person per day) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Comida por persona por día</Label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={itemSplits.comida}
                    onCheckedChange={(v) => setItemSplits(prev => ({ ...prev, comida: v }))}
                  />
                  Dividir con adultos
                </label>
              </div>
              <Input
                type="number"
                value={comidaPorPersonaDia}
                onChange={e => setComidaPorPersonaDia(e.target.value)}
                placeholder="Ej: 5000"
              />
              {dias > 0 && totalPersonas > 0 && comidaPorPersonaDia && (
                <p className="text-xs text-muted-foreground mt-1">
                  = {formatMoney(comidaTotal)} ({itemSplits.comida ? totalPersonas : beneficiariosCamp} pers × {dias} días)
                </p>
              )}
            </div>

            {/* Other items */}
            {DEFAULT_ITEMS.filter(i => !i.perPersonPerDay).map(item => (
              <div key={item.id}>
                <div className="flex items-center justify-between mb-1">
                  <Label className="flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {item.label}
                  </Label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={itemSplits[item.id]}
                      onCheckedChange={(v) => setItemSplits(prev => ({ ...prev, [item.id]: v }))}
                    />
                    Dividir con adultos
                  </label>
                </div>
                <Input
                  type="number"
                  value={itemValues[item.id] || ''}
                  onChange={e => setItemValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          {/* Resumen de costos */}
          <div className="space-y-1.5">
            {rows.map(r => (
              <div key={r.id} className="flex items-center justify-between py-1.5 px-3 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2">
                  <r.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm">{r.label}</span>
                  {r.split && <span className="text-xs text-purple-600">↗ {r.divisors} pers</span>}
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium">{formatMoney(r.value)}</span>
                  {r.detail && <p className="text-xs text-muted-foreground">{r.detail}</p>}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 px-3 bg-slate-100 rounded-md border-t-2 border-slate-300">
              <span className="text-sm font-bold">Costo total estimado</span>
              <span className="text-sm font-bold text-slate-700">{formatMoney(costoTotalEstimado)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-md">
              <span className="text-sm text-muted-foreground">Costo por beneficiario</span>
              <span className="text-sm font-medium">{formatMoney(costoPorBeneficiario)}</span>
            </div>
          </div>

          {/* Resultado */}
          <Card className={`p-4 ${resultado >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {resultado >= 0
                  ? <TrendingUp className="w-5 h-5 text-green-600" />
                  : <TrendingDown className="w-5 h-5 text-red-500" />}
                <div>
                  <p className="text-sm font-semibold">{resultado >= 0 ? 'Superávit estimado' : 'Déficit estimado'}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(ingresoTotal)} ingresos − {formatMoney(costoTotalEstimado)} gastos</p>
                </div>
              </div>
              <p className={`text-xl font-bold ${resultado >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatMoney(Math.abs(resultado))}
              </p>
            </div>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}