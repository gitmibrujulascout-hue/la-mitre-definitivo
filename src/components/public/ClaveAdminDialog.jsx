import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ClaveAdminDialog({ open, onClose, onSuccess }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [validando, setValidando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clave) {
      setError('Ingresá la clave');
      return;
    }
    setValidando(true);
    setError('');
    try {
      const res = await base44.functions.invoke('validar_clave_admin', { clave });
      if (res.data?.valido) {
        setClave('');
        onSuccess();
      } else if (res.data?.sinClave) {
        setError('No hay clave configurada. Contactá al administrador.');
      } else {
        setError('Clave incorrecta');
      }
    } catch {
      setError('Error al validar la clave');
    } finally {
      setValidando(false);
    }
  };

  const handleClose = () => {
    setClave('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Acceso administrativo
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Input
              type="password"
              autoFocus
              placeholder="Ingresá la clave de acceso"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              disabled={validando}
            />
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={validando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={validando || !clave}>
              {validando ? 'Validando...' : 'Ingresar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}