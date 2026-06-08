import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, HeartPulse, ArrowRight } from 'lucide-react';

const FIELD_LABELS = {
  grupo_sanguineo: 'Grupo sanguíneo',
  factor_rh: 'Factor RH',
  peso_kg: 'Peso (kg)',
  talla_m: 'Talla (m)',
  alergias: 'Alergias',
  condicion_medica: 'Afección médica',
  medicacion_habitual: 'Medicación habitual',
  regimen_dietario: 'Régimen dietario',
  anticoagulacion: 'Anticoagulación',
  salud_mental: 'Salud mental',
  discapacidad: 'Discapacidad / CUD',
  obra_social: 'Obra social',
  numero_obra_social: 'N° afiliado',
  contacto_emergencia_nombre: 'Contacto emergencia',
  contacto_emergencia_telefono: 'Tel. emergencia',
  contacto_emergencia_relacion: 'Relación contacto',
  observaciones_salud: 'Observaciones',
};

export default function RevisionSolicitudesSaludDialog({ open, onClose, solicitudes, beneficiarios }) {
  const queryClient = useQueryClient();
  const [procesando, setProcesando] = useState(null);

  const aprobarMutation = useMutation({
    mutationFn: async (solicitud) => {
      await base44.entities.Beneficiario.update(solicitud.beneficiario_id, solicitud.datos_propuestos);
      await base44.entities.SolicitudCambioSalud.update(solicitud.id, { estado: 'Aprobada' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes_salud'] });
      toast.success('Cambios aplicados al beneficiario.');
      setProcesando(null);
    },
  });

  const rechazarMutation = useMutation({
    mutationFn: async (solicitud) => {
      await base44.entities.SolicitudCambioSalud.update(solicitud.id, { estado: 'Rechazada' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes_salud'] });
      toast.success('Solicitud rechazada.');
      setProcesando(null);
    },
  });

  const pendientes = solicitudes.filter(s => s.estado === 'Pendiente');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-primary" />
            Solicitudes de cambio de salud ({pendientes.length})
          </DialogTitle>
        </DialogHeader>

        {pendientes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-400" />
            <p>No hay solicitudes pendientes.</p>
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            {pendientes.map(sol => {
              const ben = beneficiarios.find(b => b.id === sol.beneficiario_id);
              const campos = Object.entries(sol.datos_propuestos || {});
              const isPending = procesando === sol.id;

              return (
                <div key={sol.id} className="border rounded-lg p-4 space-y-3 bg-amber-50/40 border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{sol.beneficiario_nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        Enviado el {sol.created_date ? new Date(sol.created_date).toLocaleDateString('es-AR') : '—'}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300">Pendiente</Badge>
                  </div>

                  {/* Comparativa campo por campo */}
                  <div className="space-y-1.5">
                    {campos.map(([key, valorNuevo]) => {
                      const valorActual = ben?.[key] || '';
                      const label = FIELD_LABELS[key] || key;
                      const cambio = String(valorActual) !== String(valorNuevo);
                      return (
                        <div key={key} className={`flex items-start gap-2 rounded px-3 py-2 text-sm ${cambio ? 'bg-white border border-amber-200' : 'bg-muted/30'}`}>
                          <span className="text-muted-foreground w-40 shrink-0 text-xs pt-0.5">{label}:</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {cambio ? (
                              <>
                                <span className="line-through text-red-400 text-xs">{valorActual || <em className="text-muted-foreground">vacío</em>}</span>
                                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                <span className="font-medium text-green-700">{String(valorNuevo)}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-xs">{String(valorNuevo)} (sin cambio)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      disabled={isPending}
                      onClick={() => { setProcesando(sol.id); rechazarMutation.mutate(sol); }}
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />Rechazar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={isPending}
                      onClick={() => { setProcesando(sol.id); aprobarMutation.mutate(sol); }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />Aprobar y aplicar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}