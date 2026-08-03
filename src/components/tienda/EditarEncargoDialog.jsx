import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

/**
 * Diálogo para editar un pre-encargo (cantidad, talle, observaciones).
 * Recalcula monto_total = cantidad × precio_unitario.
 */
export default function EditarEncargoDialog({ encargo, producto, onClose, onSave }) {
  const [open, setOpen] = useState(true);
  const [cantidad, setCantidad] = useState(encargo?.cantidad || 1);
  const [talle, setTalle] = useState(encargo?.talle || '');
  const [observaciones, setObservaciones] = useState(encargo?.observaciones || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (encargo) {
      setCantidad(encargo.cantidad || 1);
      setTalle(encargo.talle || '');
      setObservaciones(encargo.observaciones || '');
    }
  }, [encargo]);

  if (!encargo) return null;

  const tieneTalles = producto?.tiene_talles && producto?.talles?.length > 0;
  const precioUnit = encargo.precio_unitario || 0;
  const montoTotal = (cantidad || 0) * precioUnit;

  const handleSave = async () => {
    if (!cantidad || cantidad < 1) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }
    setSaving(true);
    try {
      const update = {
        cantidad: Number(cantidad),
        monto_total: montoTotal,
        observaciones: observaciones || '',
      };
      if (tieneTalles) update.talle = talle || '';
      await onSave(encargo.id, update);
      setOpen(false);
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar el cambio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Editar encargo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-0.5">
            <p className="font-medium">{encargo.producto_nombre}</p>
            <p className="text-muted-foreground text-xs">{encargo.beneficiario_nombre}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
              />
            </div>

            {tieneTalles ? (
              <div className="space-y-1.5">
                <Label>Talle</Label>
                <Select value={talle} onValueChange={setTalle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sin talle" />
                  </SelectTrigger>
                  <SelectContent>
                    {producto.talles.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas (opcional)"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between bg-green-50 rounded-lg p-3 border border-green-200">
            <div className="text-xs text-muted-foreground">
              Precio unit.: <strong>{formatMoney(precioUnit)}</strong>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Nuevo total</span>
              <span className="text-lg font-bold text-green-700">{formatMoney(montoTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}