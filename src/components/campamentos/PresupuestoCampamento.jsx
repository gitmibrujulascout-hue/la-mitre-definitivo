import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { formatMoney } from '@/lib/ramaUtils';
import { Calculator, TrendingUp, TrendingDown, Users, Calendar, Utensils, Bus, MapPin, Package } from 'lucide-react';

export default function PresupuestoCampamento({ open, onClose, campamento, beneficiarios }) {
  const [comidaPorPersonaDia, setComidaPorPersonaDia] = useState('');
  const [transporteTotal, setTransporteTotal] = useState('');
  const [alojamientoTotal, setAlojamientoTotal] = useState('');
  const [materialesTotal, setMaterialesTotal] = useState('');
  const [otrosTotal, setOtrosTotal] = useState('');

  const beneficiariosCamp = useMemo(() =>
    (campamento?.beneficiarios_ids || []).length,
    [campamento]
  );
  const adultosCamp = useMemo(() =>
    (campamento?.adultos_ids || []).length,
    [campamento]
  );
  const totalPersonas = beneficiariosCamp + adultosCamp;

  const dias = useMemo(() => {
    if (!campamento?.fecha_inicio || !campamento?.fecha_fin) return 0;
    const ini = new Date(campamento.fecha_inicio + 'T12:00:00');
    const fin = new Date(campamento.fecha_fin + 'T12:00:00');
    const diff = Math.ceil((fin - ini) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }, [campamento]);

  const comidaTotal = (parseFloat(comidaPorPersonaDia) || 0) * totalPersonas * dias;
  const transporte = parseFloat(transporteTotal) || 0;
  const alojamiento = parseFloat(alojamientoTotal) || 0;
  const materiales = parseFloat(materialesTotal) || 0;
  const otros = parseFloat(otrosTotal) || 0;

  const costoTotalEstimado = comidaTotal + transporte + alojamiento + materiales + otros;

  const ingresoBeneficiarios = beneficiariosCamp * (campamento?.costo_por_persona || 0);
  const ingresoAdultos = campamento?.adultos_pagan
    ? adultosCamp * (campamento?.costo_adultos || campamento?.costo_por_persona || 0)
    : 0;
  const ingresoTotal = ingresoBeneficiarios + ingresoAdultos;

  const resultado = ingresoTotal - costoTotalEstimado;
  const costoPorPersona = totalPersonas > 0 ? costoTotalEstimado / totalPersonas : 0;

  const rows = [
    { label: 'Comida', icon: Utensils, value: comidaTotal, detail: `${formatMoney(parseFloat(comidaPorPersonaDia) || 0)} × ${totalPersonas} pers × ${dias} días` },
    { label: 'Transporte', icon: Bus, value: transporte },
    { label: 'Alojamiento / Lugar', icon: MapPin, value: alojamiento },
    { label: 'Materiales', icon: Package, value: materiales },
    { label: 'Otros gastos', icon: Calculator, value: otros },
  ];

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
            <div>
              <Label>Comida por persona por día</Label>
              <Input
                type="number"
                value={comidaPorPersonaDia}
                onChange={e => setComidaPorPersonaDia(e.target.value)}
                placeholder="Ej: 5000"
              />
              {dias > 0 && totalPersonas > 0 && comidaPorPersonaDia && (
                <p className="text-xs text-muted-foreground mt-1">
                  = {formatMoney(comidaTotal)} ({totalPersonas} pers × {dias} días)
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Transporte (total)</Label>
                <Input type="number" value={transporteTotal} onChange={e => setTransporteTotal(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Alojamiento (total)</Label>
                <Input type="number" value={alojamientoTotal} onChange={e => setAlojamientoTotal(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Materiales (total)</Label>
                <Input type="number" value={materialesTotal} onChange={e => setMaterialesTotal(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Otros gastos</Label>
                <Input type="number" value={otrosTotal} onChange={e => setOtrosTotal(e.target.value)} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Resumen de costos */}
          <div className="space-y-1.5">
            {rows.map(r => (
              <div key={r.label} className="flex items-center justify-between py-1.5 px-3 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2">
                  <r.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm">{r.label}</span>
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
              <span className="text-sm text-muted-foreground">Costo por persona</span>
              <span className="text-sm font-medium">{formatMoney(costoPorPersona)}</span>
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