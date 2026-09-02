import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Merge, AlertTriangle } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

export default function FusionarAGrupoDialog({ open, onClose, preEncargos, beneficiarios, defaultBeneficiarioNombre }) {
  const queryClient = useQueryClient();
  const [beneficiarioNombre, setBeneficiarioNombre] = useState(defaultBeneficiarioNombre || '');

  // Beneficiarios que tienen pre-encargos activos
  const beneficiariosConEncargos = useMemo(() => {
    const nombres = new Set();
    preEncargos
      .filter(e => ['Pendiente', 'Confirmado'].includes(e.estado) && !e.es_grupo)
      .forEach(e => { if (e.beneficiario_nombre) nombres.add(e.beneficiario_nombre); });
    return [...nombres].sort();
  }, [preEncargos]);

  // Pre-encargos activos del beneficiario seleccionado
  const encargosSeleccionados = useMemo(() => {
    if (!beneficiarioNombre) return [];
    return preEncargos.filter(e =>
      ['Pendiente', 'Confirmado'].includes(e.estado) &&
      !e.es_grupo &&
      e.beneficiario_nombre === beneficiarioNombre
    );
  }, [preEncargos, beneficiarioNombre]);

  // Agrupar por producto_id + talle
  const gruposFusion = useMemo(() => {
    const map = {};
    encargosSeleccionados.forEach(e => {
      const key = `${e.producto_id}__${e.talle || ''}`;
      if (!map[key]) {
        map[key] = {
          producto_id: e.producto_id,
          producto_nombre: e.producto_nombre,
          producto_imagen_url: e.producto_imagen_url,
          talle: e.talle || '',
          precio_unitario: e.precio_unitario,
          cantidad: 0,
          monto_total: 0,
          monto_pagado: 0,
          forma_pago: e.forma_pago,
          fecha_pago: e.fecha_pago,
          origen_ids: [],
        };
      }
      map[key].cantidad += (e.cantidad || 0);
      map[key].monto_total += (e.monto_total || 0);
      map[key].monto_pagado += (e.monto_pagado || 0);
      map[key].origen_ids.push(e.id);
    });
    return Object.values(map);
  }, [encargosSeleccionados]);

  const fusionar = useMutation({
    mutationFn: async () => {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

      // 1. Crear un pre-encargo del Grupo por cada grupo de fusión
      for (const g of gruposFusion) {
        await base44.entities.PreEncargoTienda.create({
          beneficiario_id: null,
          beneficiario_nombre: 'Grupo',
          es_grupo: true,
          es_pedido_proveedor: false,
          producto_id: g.producto_id,
          producto_nombre: g.producto_nombre,
          producto_imagen_url: g.producto_imagen_url,
          talle: g.talle || undefined,
          cantidad: g.cantidad,
          precio_unitario: g.precio_unitario,
          monto_total: g.monto_total,
          monto_pagado: g.monto_pagado,
          fecha_pago: g.fecha_pago || undefined,
          forma_pago: g.forma_pago || undefined,
          fecha: hoy,
          estado: 'Pendiente',
          observaciones: `Fusionado desde ${beneficiarioNombre}`,
        });
      }

      // 2. Cancelar los pre-encargos originales
      const updates = encargosSeleccionados.map(e => ({
        id: e.id,
        estado: 'Cancelado',
        monto_pagado: 0,
        stock_reservado: false,
        observaciones: `Fusionado al Grupo`,
      }));
      if (updates.length > 0) {
        await base44.entities.PreEncargoTienda.bulkUpdate(updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos'] });
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda'] });
      queryClient.invalidateQueries({ queryKey: ['productos_tienda_familia'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_caja_exclusiva'] });
      toast.success(`${gruposFusion.length} pre-encargo(s) del Grupo creado(s) a partir de ${encargosSeleccionados.length} pedido(s)`);
      onClose();
    },
    onError: (err) => toast.error('Error: ' + err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="w-4 h-4 text-primary" /> Fusionar pedidos al Grupo
          </DialogTitle>
          <DialogDescription>
            Fusiona todos los pre-encargos activos de un beneficiario en pre-encargos del Grupo (uno por producto+talle). Los pedidos originales se cancelan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Beneficiario origen *</Label>
            <Select value={beneficiarioNombre} onValueChange={setBeneficiarioNombre}>
              <SelectTrigger><SelectValue placeholder="Seleccionar beneficiario..." /></SelectTrigger>
              <SelectContent>
                {beneficiariosConEncargos.map(n => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {encargosSeleccionados.length > 0 && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  Se fusionarán <strong>{encargosSeleccionados.length}</strong> pedido(s) en <strong>{gruposFusion.length}</strong> pre-encargo(s) del Grupo.
                  Los pedidos originales se cancelarán y sus señas se transferirán al Grupo.
                </div>
              </div>

              <div className="space-y-2">
                <Label>Pre-encargos resultantes del Grupo:</Label>
                {gruposFusion.map((g, i) => (
                  <div key={i} className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{g.producto_nombre}</span>
                      {g.talle && <Badge variant="outline" className="text-xs">Talle {g.talle}</Badge>}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{g.cantidad}u × {formatMoney(g.precio_unitario)}</span>
                      <span className="font-semibold text-foreground">{formatMoney(g.monto_total)}</span>
                    </div>
                    {g.monto_pagado > 0 && (
                      <div className="text-xs text-green-600">Seña transferida: {formatMoney(g.monto_pagado)}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {beneficiarioNombre && encargosSeleccionados.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No hay pre-encargos activos para este beneficiario.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => fusionar.mutate()}
            disabled={fusionar.isPending || encargosSeleccionados.length === 0}
          >
            {fusionar.isPending ? 'Fusionando...' : `Fusionar ${encargosSeleccionados.length} pedido(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}