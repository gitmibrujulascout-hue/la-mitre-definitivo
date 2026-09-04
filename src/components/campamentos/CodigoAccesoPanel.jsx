import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Copy, RefreshCw, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

function generarCodigo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function CodigoAccesoPanel({ campamento }) {
  const queryClient = useQueryClient();
  const [mostrarCodigo, setMostrarCodigo] = useState(false);

  const { data: accesos = [] } = useQuery({
    queryKey: ['accesos_campamento', campamento.id],
    queryFn: () => base44.entities.AccesoCampamento.filter({ campamento_id: campamento.id }),
  });

  const accesoActivo = accesos.find(a => a.activo !== false);

  const crearMutation = useMutation({
    mutationFn: () => base44.entities.AccesoCampamento.create({
      campamento_id: campamento.id,
      campamento_nombre: campamento.nombre,
      codigo: generarCodigo(),
      activo: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accesos_campamento', campamento.id] });
      toast.success('Código generado');
      setMostrarCodigo(true);
    },
  });

  const regenerarMutation = useMutation({
    mutationFn: async () => {
      if (accesoActivo) {
        await base44.entities.AccesoCampamento.update(accesoActivo.id, { activo: false });
      }
      return base44.entities.AccesoCampamento.create({
        campamento_id: campamento.id,
        campamento_nombre: campamento.nombre,
        codigo: generarCodigo(),
        activo: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accesos_campamento', campamento.id] });
      toast.success('Código regenerado — el anterior ya no funciona');
      setMostrarCodigo(true);
    },
  });

  // El enlace público debe usar el despliegue actual, no Base44.
  const prodOrigin = window.location.origin;
  const url = accesoActivo
    ? `${prodOrigin}/campamento/${accesoActivo.codigo}`
    : null;

  const copiarLink = () => {
    if (url) {
      navigator.clipboard.writeText(url);
      toast.success('Link copiado al portapapeles');
    }
  };

  const copiarCodigo = () => {
    if (accesoActivo) {
      navigator.clipboard.writeText(accesoActivo.codigo);
      toast.success('Código copiado');
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-primary">
          <ShieldCheck className="w-4 h-4" />
          Acceso externo (sin login)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Generá un código para que otras personas puedan ver y gestionar este campamento sin necesitar cuenta de administrador.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!accesoActivo ? (
          <Button
            className="w-full"
            onClick={() => crearMutation.mutate()}
            disabled={crearMutation.isPending}
          >
            <Link2 className="w-4 h-4 mr-2" />
            {crearMutation.isPending ? 'Generando...' : 'Generar código de acceso'}
          </Button>
        ) : (
          <>
            {/* Código visual */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white border rounded-lg px-4 py-2.5 font-mono text-center">
                {mostrarCodigo ? (
                  <span className="text-xl font-bold tracking-[0.3em] text-primary">{accesoActivo.codigo}</span>
                ) : (
                  <span className="text-xl font-bold tracking-[0.3em] text-muted-foreground select-none">••••••••</span>
                )}
              </div>
              <button
                onClick={() => setMostrarCodigo(v => !v)}
                className="text-muted-foreground hover:text-foreground p-2"
                title={mostrarCodigo ? 'Ocultar' : 'Mostrar'}
              >
                {mostrarCodigo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                onClick={copiarCodigo}
                className="text-muted-foreground hover:text-foreground p-2"
                title="Copiar código"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>

            {/* Link completo */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white border rounded px-3 py-1.5 text-xs text-muted-foreground truncate font-mono">
                {mostrarCodigo ? url : `${prodOrigin}/campamento/••••••••`}
              </div>
              <Button size="sm" variant="outline" onClick={copiarLink}>
                <Copy className="w-3.5 h-3.5 mr-1.5" />Copiar link
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Compartí este link o el código con quienes necesiten acceder. Pueden ver el listado, registrar pagos y modificar participantes.
            </p>

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => regenerarMutation.mutate()}
              disabled={regenerarMutation.isPending}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {regenerarMutation.isPending ? 'Regenerando...' : 'Regenerar código (invalida el anterior)'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
