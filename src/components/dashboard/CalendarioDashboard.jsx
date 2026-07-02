import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarDays, ChevronLeft, ChevronRight, Cake, ShoppingBag, Tent } from 'lucide-react';
import { RAMA_CONFIG, RAMAS } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function CalendarioDashboard({ actividades, campamentos, beneficiarios }) {
  const hoy = new Date();
  const [mesSel, setMesSel] = useState(hoy.getMonth());
  const [anioSel, setAnioSel] = useState(hoy.getFullYear());

  const activos = beneficiarios.filter(b => b.activo !== false);

  const cumpleanerosMes = useMemo(() => {
    return activos
      .filter(b => {
        if (!b.fecha_nacimiento) return false;
        const mes = new Date(b.fecha_nacimiento + 'T12:00:00').getMonth();
        return mes === mesSel;
      })
      .map(b => {
        const fechaNac = new Date(b.fecha_nacimiento + 'T12:00:00');
        return { id: b.id, nombre: b.nombre, rama: b.rama, dia: fechaNac.getDate() };
      })
      .sort((a, b) => a.dia - b.dia);
  }, [activos, mesSel]);

  const eventosMes = useMemo(() => {
    const eventos = [];
    // Actividades: fecha de entrega y cierre de pedidos
    actividades.forEach(a => {
      if (a.fecha) {
        const f = new Date(a.fecha + 'T12:00:00');
        if (f.getMonth() === mesSel && f.getFullYear() === anioSel) {
          eventos.push({ tipo: 'actividad', dia: f.getDate(), titulo: a.nombre, color: 'bg-green-500', icon: ShoppingBag });
        }
      }
      if (a.fecha_cierre_pedidos) {
        const f = new Date(a.fecha_cierre_pedidos + 'T12:00:00');
        if (f.getMonth() === mesSel && f.getFullYear() === anioSel) {
          eventos.push({ tipo: 'cierre', dia: f.getDate(), titulo: `Cierre pedidos: ${a.nombre}`, color: 'bg-amber-500', icon: ShoppingBag });
        }
      }
    });
    // Campamentos: desde fecha_inicio hasta fecha_fin
    campamentos.forEach(c => {
      if (!c.fecha_inicio) return;
      const fIni = new Date(c.fecha_inicio + 'T12:00:00');
      const fFin = c.fecha_fin ? new Date(c.fecha_fin + 'T12:00:00') : fIni;
      for (let d = new Date(fIni); d <= fFin; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === mesSel && d.getFullYear() === anioSel) {
          eventos.push({ tipo: 'campamento', dia: d.getDate(), titulo: c.nombre, color: 'bg-blue-500', icon: Tent });
        }
      }
    });
    return eventos;
  }, [actividades, campamentos, mesSel, anioSel]);

  const primerDiaMes = new Date(anioSel, mesSel, 1).getDay();
  const diasEnMes = new Date(anioSel, mesSel + 1, 0).getDate();
  const diaHoy = hoy.getDate();

  const celdasCalendario = useMemo(() => {
    const celdas = [];
    for (let i = 0; i < primerDiaMes; i++) celdas.push(null);
    for (let d = 1; d <= diasEnMes; d++) {
      const cumples = cumpleanerosMes.filter(c => c.dia === d);
      const eventos = eventosMes.filter(e => e.dia === d);
      celdas.push({ dia: d, cumples, eventos });
    }
    return celdas;
  }, [primerDiaMes, diasEnMes, cumpleanerosMes, eventosMes]);

  const getRamaColor = (rama) => RAMA_CONFIG[rama]?.text || 'text-foreground';

  const cambiarMes = (delta) => {
    let nuevoMes = mesSel + delta;
    let nuevoAnio = anioSel;
    if (nuevoMes < 0) { nuevoMes = 11; nuevoAnio--; }
    if (nuevoMes > 11) { nuevoMes = 0; nuevoAnio++; }
    setMesSel(nuevoMes);
    setAnioSel(nuevoAnio);
  };

  const anios = [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1, hoy.getFullYear() + 2];

  return (
    <Card className="p-5 lg:col-span-2">
      {/* Header con navegación */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          {MESES[mesSel]} {anioSel}
        </h3>
        <div className="flex items-center gap-2">
          <Select value={mesSel.toString()} onValueChange={v => setMesSel(parseInt(v))}>
            <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={anioSel.toString()} onValueChange={v => setAnioSel(parseInt(v))}>
            <SelectTrigger className="w-[100px] h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {anios.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cambiarMes(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => cambiarMes(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mb-3 flex-wrap text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500" /> Actividad</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> Cierre pedidos</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500" /> Campamento</span>
        <span className="flex items-center gap-1">🎂 Cumpleaños</span>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      {/* Días */}
      <div className="grid grid-cols-7 gap-1">
        {celdasCalendario.map((celda, i) => {
          if (!celda) return <div key={i} className="min-h-[80px] rounded-lg bg-muted/20" />;
          const esHoy = celda.dia === diaHoy && mesSel === hoy.getMonth() && anioSel === hoy.getFullYear();
          const tieneEventos = celda.cumples.length > 0 || celda.eventos.length > 0;
          return (
            <div
              key={i}
              className={cn(
                'min-h-[80px] rounded-lg border p-1 text-xs transition-colors overflow-hidden',
                esHoy ? 'border-primary bg-primary/5' : 'border-border bg-card',
                tieneEventos ? 'shadow-sm' : ''
              )}
            >
              <div className={cn('font-medium text-right', esHoy ? 'text-primary' : 'text-muted-foreground')}>{celda.dia}</div>
              {/* Eventos */}
              {celda.eventos.map((e, idx) => (
                <div key={idx} className={cn('text-[9px] text-white rounded px-1 py-0.5 mb-0.5 leading-tight', e.color)}>
                  {e.titulo}
                </div>
              ))}
              {/* Cumpleaños */}
              {celda.cumples.map(c => (
                <div key={c.id} className={cn('text-[9px] font-medium leading-tight', getRamaColor(c.rama))}>
                  🎂 {c.nombre}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Cumpleaños del mes */}
      <div className="mt-4 pt-4 border-t border-border">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Cake className="w-4 h-4 text-primary" />
          Cumpleaños de {MESES[mesSel]}
        </h4>
        {cumpleanerosMes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cumpleaños este mes</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {cumpleanerosMes.map(c => (
              <div key={c.id} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {c.dia}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', getRamaColor(c.rama))}>{c.nombre}</p>
                  {c.rama && <p className="text-xs text-muted-foreground">{c.rama}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}