import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import CalendarioGrid from './CalendarioGrid';
import EventoCalendarioForm from './EventoCalendarioForm';
import { getEventoColor } from '@/lib/calendarioUtils';
import { useToast } from '@/components/ui/use-toast';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CalendarioDashboard({ actividades, campamentos, beneficiarios }) {
  const [showForm, setShowForm] = useState(false);
  const [eventoEdit, setEventoEdit] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: eventosCalendario = [] } = useQuery({
    queryKey: ['eventos_calendario'],
    queryFn: () => base44.entities.EventoCalendario.list('-fecha', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EventoCalendario.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos_calendario'] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EventoCalendario.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos_calendario'] });
      setShowForm(false);
      setEventoEdit(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.EventoCalendario.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos_calendario'] });
      toast({ title: 'Evento eliminado' });
    },
  });

  const activos = beneficiarios.filter((b) => b.activo !== false);

  const cumples = useMemo(
    () =>
      activos
        .filter((b) => b.fecha_nacimiento)
        .map((b) => {
          const f = new Date(b.fecha_nacimiento + 'T12:00:00');
          return { id: b.id, nombre: b.nombre, rama: b.rama, dia: f.getDate(), mes: f.getMonth() };
        }),
    [activos]
  );

  const eventos = useMemo(() => {
    const evs = [];
    // Actividades económicas: fecha de entrega y cierre de pedidos
    actividades.forEach((a) => {
      if (a.fecha) {
        const f = new Date(a.fecha + 'T12:00:00');
        evs.push({ dia: f.getDate(), mes: f.getMonth(), anio: f.getFullYear(), titulo: a.nombre, color: 'bg-green-500' });
      }
      if (a.fecha_cierre_pedidos) {
        const f = new Date(a.fecha_cierre_pedidos + 'T12:00:00');
        evs.push({ dia: f.getDate(), mes: f.getMonth(), anio: f.getFullYear(), titulo: `Cierre: ${a.nombre}`, color: 'bg-amber-500' });
      }
    });
    // Campamentos: rango de fechas
    campamentos.forEach((c) => {
      if (!c.fecha_inicio) return;
      const fIni = new Date(c.fecha_inicio + 'T12:00:00');
      const fFin = c.fecha_fin ? new Date(c.fecha_fin + 'T12:00:00') : fIni;
      for (let d = new Date(fIni); d <= fFin; d.setDate(d.getDate() + 1)) {
        evs.push({ dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear(), titulo: c.nombre, color: 'bg-blue-500' });
      }
    });
    // Eventos del calendario (coloreados por rama)
    eventosCalendario.forEach((ev) => {
      const { bg, dots } = getEventoColor(ev);
      const fIni = new Date(ev.fecha + 'T12:00:00');
      const fFin = ev.fecha_fin ? new Date(ev.fecha_fin + 'T12:00:00') : fIni;
      for (let d = new Date(fIni); d <= fFin; d.setDate(d.getDate() + 1)) {
        evs.push({ dia: d.getDate(), mes: d.getMonth(), anio: d.getFullYear(), titulo: ev.nombre, color: bg, dots });
      }
    });
    return evs;
  }, [actividades, campamentos, eventosCalendario]);

  // Eventos del calendario del mes actual para gestión rápida
  const hoy = new Date();
  const eventosMesActual = useMemo(() => {
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();
    return eventosCalendario
      .filter((ev) => {
        const fIni = new Date(ev.fecha + 'T12:00:00');
        const fFin = ev.fecha_fin ? new Date(ev.fecha_fin + 'T12:00:00') : fIni;
        return (fIni.getMonth() === mes && fIni.getFullYear() === anio) ||
               (fFin.getMonth() === mes && fFin.getFullYear() === anio);
      })
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  }, [eventosCalendario]);

  const legendItems = [
    { color: 'bg-green-500', label: 'Actividad económica' },
    { color: 'bg-amber-500', label: 'Cierre pedidos' },
    { color: 'bg-blue-500', label: 'Campamento' },
    { color: 'bg-indigo-500', label: 'Evento grupal' },
  ];

  const handleSubmit = (data) => {
    if (eventoEdit) {
      updateMutation.mutate({ id: eventoEdit.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <CalendarioGrid
        eventos={eventos}
        cumples={cumples}
        editable
        onAddEvent={() => { setEventoEdit(null); setShowForm(true); }}
        legendItems={legendItems}
      />

      {/* Gestión de eventos del mes */}
      <Card className="p-4 mt-4">
        <h4 className="font-semibold text-sm mb-3">Eventos de {MESES[hoy.getMonth()]} — gestión</h4>
        {eventosMesActual.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay eventos creados este mes. Usá el botón "Evento" para agregar uno.</p>
        ) : (
          <div className="space-y-1.5">
            {eventosMesActual.map((ev) => {
              const { bg, dots } = getEventoColor(ev);
              return (
                <div key={ev.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', bg)} />
                  {dots?.map((d, i) => <span key={i} className={cn('w-1.5 h-1.5 rounded-full -ml-1.5', d)} />)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {ev.fecha}{ev.fecha_fin && ev.fecha_fin !== ev.fecha ? ` → ${ev.fecha_fin}` : ''}
                      {ev.ubicacion && <span className="inline-flex items-center gap-0.5 ml-2"><MapPin className="w-3 h-3" />{ev.ubicacion}</span>}
                      {ev.todo_el_grupo ? ' · Todo el grupo' : (ev.ramas_participantes?.length ? ` · ${ev.ramas_participantes.join(', ')}` : '')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEventoEdit(ev); setShowForm(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('¿Eliminar este evento?')) deleteMutation.mutate(ev.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <EventoCalendarioForm
        open={showForm}
        onClose={() => { setShowForm(false); setEventoEdit(null); }}
        onSubmit={handleSubmit}
        submitting={submitting}
        eventoEdit={eventoEdit}
      />
    </>
  );
}