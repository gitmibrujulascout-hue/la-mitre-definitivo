import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Users } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

export default function PreEncargoGrupoForm({ open, onClose, productos }) {
  const queryClient = useQueryClient();
  const [productoId, setProductoId] = useState('');
  const [talle, setTalle] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [esPedidoProveedor, setEsPedidoProveedor] = useState(true);
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const [observaciones, setObservaciones] = useState('');

  const producto = useMemo(() => productos.find(p => p.id === productoId), [productos, productoId]);

  const montoTotal = (parseFloat(cantidad) || 0) * (parseFloat(precioUnitario) || 0);

  const crear = useMutation({
    mutationFn: async () => {
      const data = {
        beneficiario_id: null,
        beneficiario_nombre: 'Grupo',
        es_grupo: true,
        es_pedido_proveedor: esPedidoProveedor,
        producto_id: productoId,
        producto_nombre: producto?.nombre || '',
        producto_imagen_url: producto?.imagen_url || producto?.imagenes_url?.[0] || '',
        talle: talle || undefined,
        cantidad: parseInt(cantidad) || 1,
        precio_unitario: parseFloat(precioUnitario) || 0,
        monto_total: montoTotal,
        monto_pagado: 0,
        fecha,
        estado: 'Pendiente',
        observaciones,
      };
      await base44.entities.PreEncargoTienda.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre_encargos'] });
      queryClient.invalidateQueries({ queryKey: ['pre_encargos_familia'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Pre-encargo del Grupo creado');
      handleClose();
    },
    onError: (err) => toast.error('Error: ' + err.message),
  });

  const handleClose = () => {
    setProductoId('');
    setTalle('');
    setCantidad('1');
    setPrecioUnitario('');
    setEsPedidoProveedor(true);
    setObservaciones('');
    onClose();
  };

  const handleSubmit = () => {
    if (!productoId) { toast.error('Seleccioná un producto'); return; }
    if ((parseInt(cantidad) || 0) <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
    if ((parseFloat(precioUnitario) || 0) <= 0) { toast.error('El precio unitario debe ser mayor a 0'); return; }
    crear.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Pre-encargo del Grupo
          </DialogTitle>
          <DialogDescription>
            Cargá un pedido del Grupo: ya sea a un proveedor (reposición de stock) o como responsable de familias.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de pedido */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEsPedidoProveedor(true)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                esPedidoProveedor ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
              }`}
            >
              <Truck className={`w-5 h-5 ${esPedidoProveedor ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium">Pedido a proveedor</span>
              <span className="text-[10px] text-muted-foreground">Seña = gasto</span>
            </button>
            <button
              type="button"
              onClick={() => setEsPedidoProveedor(false)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                !esPedidoProveedor ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'
              }`}
            >
              <Users className={`w-5 h-5 ${!esPedidoProveedor ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs font-medium">Grupo responsable</span>
              <span className="text-[10px] text-muted-foreground">Seña = ingreso</span>
            </button>
          </div>

          {/* Producto */}
          <div className="space-y-1.5">
            <Label>Producto *</Label>
            <Select value={productoId} onValueChange={(v) => { setProductoId(v); const p = productos.find(p => p.id === v); if (p) setPrecioUnitario(esPedidoProveedor ? (p.precio_costo || p.precio_venta || '') : (p.precio_venta || '')); setTalle(''); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
              <SelectContent>
                {productos.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Talle */}
          {producto?.tiene_talles && producto?.talles?.length > 0 && (
            <div className="space-y-1.5">
              <Label>Talle *</Label>
              <Select value={talle} onValueChange={setTalle}>
                <SelectTrigger><SelectValue placeholder="Seleccionar talle..." /></SelectTrigger>
                <SelectContent>
                  {producto.talles.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Cantidad y precio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cantidad *</Label>
              <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{esPedidoProveedor ? 'Precio costo unit. *' : 'Precio venta unit. *'}</Label>
              <Input type="number" min="0" step="0.01" value={precioUnitario} onChange={(e) => setPrecioUnitario(e.target.value)} />
            </div>
          </div>

          {/* Total */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Monto total</span>
            <span className="text-lg font-bold">{formatMoney(montoTotal)}</span>
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del admin..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={crear.isPending}>
            {crear.isPending ? 'Creando...' : 'Crear pre-encargo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}