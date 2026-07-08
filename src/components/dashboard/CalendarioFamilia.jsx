import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import CalendarioGrid from './CalendarioGrid';
import { getEventoColor, eventoRelevanteParaRamas } from '@/lib/calendarioUtils';

const COLORS = {
  actividadEntrega: 'bg-green-500',
  actividadCierre: 'bg-amber-500',
  actividadPago: 'bg-orange-500',
  campamento: 'bg-blue-500',
};

/**
 * Calendario para familias: muestra eventos del calendario, actividades económicas
 * (cierre, pago, entrega) y campamentos relevantes para las ramas del grupo familiar.
 */
export default function CalendarioFamilia({ grupoFamiliar }) {
  const { data: eventosCalendario = [] } = useQuery({
    queryKey: ['eventos_calendario'],
    queryFn: () => base44.entities.EventoCalendario.list('-fecha', 500),
  });

  const { data: actividades = [] } = useQuery({
    queryKey: ['actividades_economicas_familia'],
    queryFn: () => base44.entities.ActividadEconomica.list('-fecha', 200),
  });

  const { data: campamentos = [] } = useQuery({
    queryKey: ['campamentos_familia'],
    queryFn: () => base44.entities.Campamento.list('-fecha_inicio', 200),
  });

  const ramasFamilia = useMemo(() => {
    const ramas = new Set();
    grupoFamiliar.forEach((b) => { if (b.rama) ramas.add(b.rama); });
    return [...ramas];
  }, [grupoFamiliar]);

  const idsFamilia = useMemo(
    () => new Set(grupoFamiliar.map((b) => b.id)),
    [grupoFamiliar]
  );

  const actividadesRelevantes = useMemo(
    () => actividades.filter((a) => {
      const ramas = a.ramas_participantes || [];
      if (ramas.length === 0) return true;
      return ramas.some((r) => ramasFamilia.includes(r));
    }),
    [actividades, ramasFamilia]
  );

  const campamentosRelevantes = useMemo(
    () => campamentos.filter((c) => {
      const ramas = c.ramas_participantes || [];
      if (ramas.length === 0) return true;
      if (ramas.some((r) => ramasFamilia.includes(r))) return true;
      if (c.beneficiarios_ids?.some((id) => idsFamilia.has(id))) return true;
      return false;
    }),
    [campamentos, ramasFamilia, idsFamilia]
  );

  const eventosRelevantes = useMemo(
    () => eventosCalendario.filter((ev) => eventoRelevanteParaRamas(ev, ramasFamilia)),
    [eventosCalendario, ramasFamilia]
  );

  const cumples = useMemo(
    () =>
      grupoFamiliar
        .filter((b) => b.fecha_nacimiento)
        .map((b) => {
          const f = new Date(b.fecha_nacimiento + 'T12:00:00');
          return { id: b.id, nombre: b.nombre, rama: b.rama, dia: f.getDate(), mes: f.getMonth() };
        }),
    [grupoFamiliar]
  );

  const eventos = useMemo(() => {
    const evs = [];

    // Actividades económicas: entrega, cierre de pedidos y fecha de pago
    actividadesRelevantes.forEach((a) => {
      if (a.fecha) {
        const f = new Date(a.fecha + 'T12:00:00');
        evs.push({ dia: f.getDate(), mes: f.getMonth(), anio: f.getFullYear(), titulo: `Entrega: ${a.nombre}`, color: COLORS.actividadEntrega });
      }
      if (a.fecha_cierre_pedidos) {
        const f = new Date(a.fecha_cierre_pedidos + 'T12:00:00');
        evs.push({ dia: f.getDate(), mes: f.getMonth(), anio: f.getFullYear(), titulo: `Cierre: ${a.nombre}`, color: COLORS.actividadCierre });
      }
      if (a.fecha_pago) {
        const f = new Date(a.fecha_pago + 'T12:00:00');
        evs.push({ dia: f.getDate(), mes: f.getMonth(), anio: f.getFullYear(), titulo: `Pago: ${a.nombre}`, color: COLORS.actividadPago });
      }
    });

    // Campamentos: rango de fechas
    campamentosRelevantes.forEach((c) => {
      if (!c.fecha_inicio) return;
      const fIni = new Date(c.fecha_inicio + 'T12:00:00');
      const fFin = c.fecha_fin ? new Date(c.fecha_fin + 'T12:00:00') : fIni;
      for (let d = new Date(fIni); d <= fFin; d.setDate(d.getDate() + 1)) {
        evs.push({ dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear(), titulo: c.nombre, color: COLORS.campamento });
      }
    });

    // Eventos del calendario (coloreados por rama)
    eventosRelevantes.forEach((ev) => {
      const { bg, dots } = getEventoColor(ev);
      const fIni = new Date(ev.fecha + 'T12:00:00');
      const fFin = ev.fecha_fin ? new Date(ev.fecha_fin + 'T12:00:00') : fIni;
      for (let d = new Date(fIni); d <= fFin; d.setDate(d.getDate() + 1)) {
        evs.push({ dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear(), titulo: ev.nombre, color: bg, dots });
      }
    });

    return evs;
  }, [actividadesRelevantes, campamentosRelevantes, eventosRelevantes]);

  const legendItems = [
    { color: COLORS.actividadEntrega, label: 'Entrega actividad' },
    { color: COLORS.actividadCierre, label: 'Cierre pedidos' },
    { color: COLORS.actividadPago, label: 'Pago actividad' },
    { color: COLORS.campamento, label: 'Campamento' },
    { color: 'bg-indigo-500', label: 'Todo el grupo' },
    { color: 'bg-yellow-400', label: 'Lobatos' },
    { color: 'bg-green-500', label: 'Tropa' },
    { color: 'bg-blue-400', label: 'KM' },
    { color: 'bg-red-500', label: 'Rovers' },
    { color: 'bg-purple-500', label: 'Adultos' },
  ];

  return (
    <CalendarioGrid
      eventos={eventos}
      cumples={cumples}
      legendItems={legendItems}
      title="Actividades"
    />
  );
}