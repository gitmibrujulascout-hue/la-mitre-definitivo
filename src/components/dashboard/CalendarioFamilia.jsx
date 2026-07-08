import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import CalendarioGrid from './CalendarioGrid';
import { getEventoColor, eventoRelevanteParaRamas } from '@/lib/calendarioUtils';

/**
 * Calendario para familias: muestra solo los eventos del calendario relevantes
 * para las ramas de los beneficiarios consultados + cumpleaños del grupo familiar.
 */
export default function CalendarioFamilia({ grupoFamiliar }) {
  const { data: eventosCalendario = [] } = useQuery({
    queryKey: ['eventos_calendario'],
    queryFn: () => base44.entities.EventoCalendario.list('-fecha', 500),
  });

  const ramasFamilia = useMemo(() => {
    const ramas = new Set();
    grupoFamiliar.forEach((b) => { if (b.rama) ramas.add(b.rama); });
    return [...ramas];
  }, [grupoFamiliar]);

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
    eventosRelevantes.forEach((ev) => {
      const { bg, dots } = getEventoColor(ev);
      const fIni = new Date(ev.fecha + 'T12:00:00');
      const fFin = ev.fecha_fin ? new Date(ev.fecha_fin + 'T12:00:00') : fIni;
      for (let d = new Date(fIni); d <= fFin; d.setDate(d.getDate() + 1)) {
        evs.push({
          dia: d.getDate(),
          mes: d.getMonth(),
          anio: d.getFullYear(),
          titulo: ev.nombre,
          color: bg,
          dots,
        });
      }
    });
    return evs;
  }, [eventosRelevantes]);

  const legendItems = [
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