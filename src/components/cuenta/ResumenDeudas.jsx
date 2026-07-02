import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, AlertCircle, Tent, FileText, CheckCircle2, Users, Wallet } from 'lucide-react';
import { MESES, MESES_SIN_CUOTA, formatMoney } from '@/lib/ramaUtils';
import RamaBadge from '@/components/shared/RamaBadge';

export default function ResumenDeudas({ cuentas, anio, onSelectBen, onRegisterPago }) {
  const hoy = new Date();
  const mesActual = hoy.getMonth();
  const mesesTranscurridos = anio < hoy.getFullYear() ? 12 : anio > hoy.getFullYear() ? 0 : mesActual + 1;
  const mesesRelevantes = MESES.slice(0, mesesTranscurridos).filter(m => !MESES_SIN_CUOTA.includes(m));

  const deudasPorMes = useMemo(() => {
    return mesesRelevantes.map(mes => {
      const deudores = cuentas
        .filter(c => c.mesesDeuda?.includes(mes) && !c.becado)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      const total = deudores.reduce((s, c) => s + (c.cuotaIndividual || 0), 0);
      return { mes, deudores, total };
    }).filter(d => d.deudores.length > 0);
  }, [cuentas]);

  const deudoresCampamento = useMemo(() => {
    return cuentas
      .filter(c => (c.deudaCampamento || 0) > 0)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [cuentas]);

  const deudoresAfiliacion = useMemo(() => {
    return cuentas
      .filter(c => c.saldoAfiliacion < 0 && !c.esPrimeraVezAfiliacion)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [cuentas]);

  const alDia = cuentas.filter(c => c.alDia).length;
  const conDeuda = cuentas.filter(c => !c.alDia && !c.becado).length;
  const becados = cuentas.filter(c => c.becado).length;
  const totalDeudaCuotas = deudasPorMes.reduce((s, d) => s + d.total, 0);
  const totalDeudaCamp = deudoresCampamento.reduce((s, c) => s + c.deudaCampamento, 0);
  const totalDeudaAfil = deudoresAfiliacion.reduce((s, c) => s + Math.abs(c.saldoAfiliacion), 0);

  const sinDeudas = deudasPorMes.length === 0 && deudoresCampamento.length === 0 && deudoresAfiliacion.length === 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-full bg-green-100 p-2"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
          <div>
            <p className="text-2xl font-bold text-green-600">{alDia}</p>
            <p className="text-xs text-muted-foreground">Al día</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-full bg-red-100 p-2"><AlertCircle className="w-5 h-5 text-red-600" /></div>
          <div>
            <p className="text-2xl font-bold text-red-600">{conDeuda}</p>
            <p className="text-xs text-muted-foreground">Con deuda</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-full bg-amber-100 p-2"><Users className="w-5 h-5 text-amber-600" /></div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{becados}</p>
            <p className="text-xs text-muted-foreground">Becados</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="rounded-full bg-red-100 p-2"><Wallet className="w-5 h-5 text-red-600" /></div>
          <div>
            <p className="text-xl font-bold text-red-600">{formatMoney(totalDeudaCuotas + totalDeudaCamp + totalDeudaAfil)}</p>
            <p className="text-xs text-muted-foreground">Deuda total</p>
          </div>
        </Card>
      </div>

      {deudasPorMes.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Cuotas adeudadas por mes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {deudasPorMes.map(({ mes, deudores, total }) => (
              <MesCard key={mes} mes={mes} deudores={deudores} total={total} onSelectBen={onSelectBen} onRegisterPago={onRegisterPago} />
            ))}
          </div>
        </div>
      )}

      {deudoresCampamento.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Tent className="w-5 h-5" /> Deudas de campamento</h3>
          <Card className="divide-y">
            {deudoresCampamento.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/30 cursor-pointer" onClick={() => onSelectBen(c)}>
                <div className="flex items-center gap-2 min-w-0">
                  <RamaBadge rama={c.rama} />
                  <span className="font-medium truncate">{c.nombre}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-red-600 font-semibold">{formatMoney(c.deudaCampamento)}</span>
                  <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onRegisterPago(c.id); }}>Pago</Button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {deudoresAfiliacion.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><FileText className="w-5 h-5" /> Deudas de afiliación</h3>
          <Card className="divide-y">
            {deudoresAfiliacion.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 hover:bg-muted/30 cursor-pointer" onClick={() => onSelectBen(c)}>
                <div className="flex items-center gap-2 min-w-0">
                  <RamaBadge rama={c.rama} />
                  <span className="font-medium truncate">{c.nombre}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className="text-xs">{c.afiliacionAnio ? 'Parcial' : 'Sin afiliar'}</Badge>
                  <span className="text-red-600 font-semibold">{formatMoney(Math.abs(c.saldoAfiliacion))}</span>
                  <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onRegisterPago(c.id); }}>Pago</Button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {sinDeudas && (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-green-600">¡Todos al día!</p>
          <p className="text-muted-foreground">No hay deudas registradas para {anio}</p>
        </Card>
      )}
    </div>
  );
}

function MesCard({ mes, deudores, total, onSelectBen, onRegisterPago }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
            <div className="text-left">
              <p className="font-semibold text-base">{mes}</p>
              <p className="text-xs text-muted-foreground">{deudores.length} debe{deudores.length !== 1 ? 'n' : ''} · {formatMoney(total)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-red-100 text-red-700 border-red-300 border">{deudores.length}</Badge>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y border-t">
            {deudores.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2.5 hover:bg-muted/20 cursor-pointer" onClick={() => onSelectBen(c)}>
                <div className="flex items-center gap-2 min-w-0">
                  <RamaBadge rama={c.rama} />
                  <span className="text-sm font-medium truncate">{c.nombre}</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={e => { e.stopPropagation(); onRegisterPago(c.id); }}>+ Pago</Button>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}