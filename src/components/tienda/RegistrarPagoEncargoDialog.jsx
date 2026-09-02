import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const FORMAS_PAGO = ['Efectivo', 'Transferencia'];

export default function RegistrarPagoEncargoDialog({ encargo, producto, onClose, onSave }) {
  const [open, setOpen] = useState(true);
  const [monto, setMonto] = useState('');
  const [formaPago, setFormaPago] = useState('Efectivo');
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (encargo) {
      setMonto('');
      setFormaPago('Efectivo');
      setFecha(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }));
    }
  }, [encargo]);

  if (!encargo) return null;

  const montoTotal = encargo.monto_total || 0;
  const yaPagado = encargo.monto_pagado || 0;
  const saldo = Math.max(0, montoTotal - yaPagado);
  const montoNum = parseFloat(monto) || 0;

  const handleSave = async () => {
    if (montoNum <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }
    if (montoNum > saldo) {
      toast.error(`El monto excede el saldo pendiente (${formatMoney(saldo)})`);
      return;
    }
    setSaving(true);
    try {
      const nuevoPagado = yaPagado + montoNum;
      const update = {
        monto_pagado: nuevoPagado,
        fecha_pago: fecha,
        forma_pago: formaPago,
      };
      // El ingreso de la seña se deriva de PreEncargoTienda.monto_pagado en cajaUtils.
      // No se crea MovimientoBanco (fuente única: PreEncargoTienda).
      await onSave(encargo.id, update);
      toast.success('Pago registrado');
      setOpen(false);
      onClose();
    } catch {
      toast.error('No se pudo registrar el pago');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" /> Registrar pago
          </DialogTitle>
          <DialogDescription>
            Registra una seña o pago parcial del pre-encargo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <p className="font-medium">{encargo.producto_nombre}</p>
            <p className="text-muted-foreground text-xs">{encargo.beneficiario_nombre}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/40 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold text-sm">{formatMoney(montoTotal)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Pagado</p>
              <p className="font-bold text-sm text-green-700">{formatMoney(yaPagado)}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="font-bold text-sm text-amber-700">{formatMoney(saldo)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto a pagar *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={saldo}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder={saldo.toString()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pago</Label>
              <div className="flex gap-2">
                {FORMAS_PAGO.map(fp => (
                  <Button
                    key={fp}
                    type="button"
                    variant={formaPago === fp ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setFormaPago(fp)}
                  >
                    {fp}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Fecha de pago</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setMonto(saldo.toString())}
              disabled={saldo === 0}
            >
              Pago completo ({formatMoney(saldo)})
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setMonto((Math.round(saldo / 2 * 100) / 100).toString())}
              disabled={saldo === 0}
            >
              Mitad (50%)
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || montoNum <= 0}>
            {saving ? 'Guardando...' : 'Registrar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}