import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, ShieldCheck, Calendar, Users, UserCog, Trash2 } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

export default function ConfigAfiliacionPanel({ anio }) {
  const queryClient = useQueryClient();
  const [montoGeneral, setMontoGeneral] = useState('');
  const [montoAcompanante, setMontoAcompanante] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const { data: configs = [] } = useQuery({
    queryKey: ['config-afiliacion'],
    queryFn: () => base44.entities.ConfigAfiliacion.list('-anio', 50),
  });

  const configAnio = configs.find(c => Number(c.anio) === Number(anio));

  // Cargar valores cuando llega la config
  const g = configAnio?.monto_general;
  const a = configAnio?.monto_acompanante;
  const f = configAnio?.fecha_limite_primera_vez;

  const valGeneral = montoGeneral !== '' ? montoGeneral : (g != null ? String(g) : '42000');
  const valAcompanante = montoAcompanante !== '' ? montoAcompanante : (a != null ? String(a) : '25000');
  const valFecha = fechaLimite !== '' ? fechaLimite : (f || '');

  const saveMut = useMutation({
    mutationFn: async () => {
      const data = {
        anio: Number(anio),
        monto_general: parseFloat(valGeneral) || 0,
        monto_acompanante: parseFloat(valAcompanante) || 0,
        fecha_limite_primera_vez: valFecha || null,
        observaciones: observaciones || configAnio?.observaciones || null,
      };
      if (configAnio) {
        return base44.entities.ConfigAfiliacion.update(configAnio.id, data);
      }
      return base44.entities.ConfigAfiliacion.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-afiliacion'] });
      setMontoGeneral(''); setMontoAcompanante(''); setFechaLimite(''); setObservaciones('');
      toast.success('Configuración de afiliación guardada');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ConfigAfiliacion.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-afiliacion'] });
      toast.success('Configuración eliminada');
    },
  });

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const limiteVencido = valFecha && hoy > valFecha;

  return (
    <Card className="p-5 mb-6 border-blue-200 bg-blue-50/30">
      <div className="flex items-start gap-3 mb-4">
        <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
        <div>
          <h3 className="font-semibold text-sm text-blue-900">Configuración de Afiliación — {anio}</h3>
          <p className="text-xs text-blue-700 mt-0.5">
            Definí los montos del seguro y la fecha límite para la bonificación de primera afiliación.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <Label className="text-xs flex items-center gap-1"><Users className="w-3 h-3" />Beneficiarios (general)</Label>
          <Input
            type="number"
            value={valGeneral}
            onChange={e => setMontoGeneral(e.target.value)}
            placeholder="42000"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground mt-0.5">Menores / beneficiarios</p>
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1"><UserCog className="w-3 h-3" />Acompañantes</Label>
          <Input
            type="number"
            value={valAcompanante}
            onChange={e => setMontoAcompanante(e.target.value)}
            placeholder="25000"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground mt-0.5">Adultos / voluntarios / educadores</p>
        </div>
        <div>
          <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3" />Fecha límite 1ª afiliación</Label>
          <Input
            type="date"
            value={valFecha}
            onChange={e => setFechaLimite(e.target.value)}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground mt-0.5">
            {valFecha
              ? limiteVencido
                ? <span className="text-amber-600">⚠ Vencida — primera afiliación debe pagar</span>
                : <span className="text-green-600">Vigente — 1ª afiliación no abona hasta esta fecha</span>
              : 'Sin límite — 1ª afiliación siempre bonificada'}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <Label className="text-xs">Observaciones</Label>
        <Input
          value={observaciones !== '' ? observaciones : (configAnio?.observaciones || '')}
          onChange={e => setObservaciones(e.target.value)}
          placeholder="Ej: aumento aplicado en julio"
          className="h-9"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          <Save className="w-3.5 h-3.5 mr-1" />{configAnio ? 'Actualizar' : 'Guardar'}
        </Button>
        {configAnio && (
          <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(configAnio.id)} disabled={deleteMut.isPending}>
            <Trash2 className="w-3.5 h-3.5 mr-1 text-muted-foreground" />Eliminar
          </Button>
        )}
        {configAnio && (
          <div className="flex gap-2 flex-wrap ml-auto">
            <Badge variant="outline" className="text-xs">General: {formatMoney(configAnio.monto_general)}</Badge>
            {configAnio.monto_acompanante != null && (
              <Badge variant="outline" className="text-xs">Acompañante: {formatMoney(configAnio.monto_acompanante)}</Badge>
            )}
            {configAnio.fecha_limite_primera_vez && (
              <Badge variant="outline" className="text-xs">Límite 1ª: {configAnio.fecha_limite_primera_vez}</Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}