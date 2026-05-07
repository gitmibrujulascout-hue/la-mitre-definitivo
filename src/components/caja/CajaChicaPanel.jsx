import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ShoppingBag, Plus, CheckCircle2, Clock, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function CajaChicaForm({ open, onClose, inicial }) {
  const [form, setForm] = useState(inicial || {
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: 'Caja chica cocina',
    responsable: '',
    observaciones: '',
    estado: 'Abierta',
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: data => base44.entities.CajaChica.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caja_chica'] });
      toast.success('Caja chica registrada');
      onClose();
    }
  });

  const handleSave = () => {
    if (!form.monto || !form.fecha) return;
    createMutation.mutate({ ...form, monto: parseFloat(form.monto) });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Caja Chica</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto *</Label>
              <Input type="number" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Concepto</Label>
            <Input value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))} placeholder="Ej: Caja chica cocina" />
          </div>
          <div>
            <Label>Responsable</Label>
            <Input value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} placeholder="Nombre del voluntario" />
          </div>
          <div>
            <Label>Observaciones</Label>
            <Input value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.monto || !form.fecha || createMutation.isPending}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CajaChicaPanel() {
  const [showForm, setShowForm] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const queryClient = useQueryClient();

  const { data: registros = [] } = useQuery({
    queryKey: ['caja_chica'],
    queryFn: () => base44.entities.CajaChica.list('-fecha', 50),
  });

  const cerrarMutation = useMutation({
    mutationFn: id => base44.entities.CajaChica.update(id, { estado: 'Cerrada' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['caja_chica'] }); toast.success('Caja chica cerrada'); }
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.CajaChica.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['caja_chica'] }); toast.success('Eliminado'); }
  });

  const abiertas = registros.filter(r => r.estado === 'Abierta');
  const cerradas = registros.filter(r => r.estado === 'Cerrada');
  const totalAbierto = abiertas.reduce((s, r) => s + (r.monto || 0), 0);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpandido(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ShoppingBag className="w-4 h-4 text-orange-500" />
          Caja Chica
          {abiertas.length > 0 && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-300 border text-xs ml-1">
              {abiertas.length} abierta{abiertas.length > 1 ? 's' : ''} · {formatMoney(totalAbierto)}
            </Badge>
          )}
          {expandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3 mr-1" />Nueva
        </Button>
      </div>

      {expandido && (
        <div className="space-y-2">
          {registros.length === 0 && (
            <p className="text-sm text-muted-foreground py-3 text-center">No hay registros de caja chica</p>
          )}
          {registros.map(r => (
            <Card key={r.id} className={cn(
              'border',
              r.estado === 'Abierta' ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200 bg-slate-50/40 opacity-70'
            )}>
              <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {r.estado === 'Abierta'
                    ? <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.concepto || 'Caja chica'}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.fecha}{r.responsable ? ` · ${r.responsable}` : ''}
                      {r.observaciones ? ` · ${r.observaciones}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p className={cn("text-base font-bold", r.estado === 'Abierta' ? 'text-orange-600' : 'text-muted-foreground')}>
                    {formatMoney(r.monto)}
                  </p>
                  <Badge className={cn(
                    'text-xs border',
                    r.estado === 'Abierta' ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-slate-100 text-slate-500 border-slate-200'
                  )}>
                    {r.estado}
                  </Badge>
                  {r.estado === 'Abierta' && (
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => cerrarMutation.mutate(r.id)}>
                      Cerrar
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMutation.mutate(r.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && <CajaChicaForm open onClose={() => setShowForm(false)} />}
    </div>
  );
}