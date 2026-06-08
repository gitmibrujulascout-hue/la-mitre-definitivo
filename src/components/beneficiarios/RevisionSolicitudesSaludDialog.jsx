import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, HeartPulse, ArrowRight, Pencil, Check, X } from 'lucide-react';

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
  detalle_discapacidad: 'Detalle discapacidad',
  obra_social: 'Obra social',
  numero_obra_social: 'N° afiliado',
  contacto_emergencia_nombre: 'Contacto emergencia',
  contacto_emergencia_telefono: 'Tel. emergencia',
  contacto_emergencia_relacion: 'Relación contacto',
  observaciones_salud: 'Observaciones',
};

function CampoEditable({ fieldKey, valorNuevo, valorActual, editedValues, setEditedValues }) {
  const [editando, setEditando] = useState(false);
  const [temp, setTemp] = useState('');
  const label = FIELD_LABELS[fieldKey] || fieldKey;
  const cambio = String(valorActual) !== String(valorNuevo);
  const valorFinal = editedValues[fieldKey] !== undefined ? editedValues[fieldKey] : valorNuevo;

  const iniciarEdicion = () => {
    setTemp(String(valorFinal));
    setEditando(true);
  };

  const confirmarEdicion = () => {
    setEditedValues(prev => ({ ...prev, [fieldKey]: temp }));
    setEditando(false);
  };

  const cancelarEdicion = () => setEditando(false);

  const fueEditado = editedValues[fieldKey] !== undefined && editedValues[fieldKey] !== String(valorNuevo);

  return (
    <div className={`flex items-start gap-2 rounded px-3 py-2 text-sm ${cambio ? 'bg-white border border-amber-200' : 'bg-muted/30'}`}>
      <span className="text-muted-foreground w-36 shrink-0 text-xs pt-1.5">{label}:</span>
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        {cambio ? (
          <>
            <span className="line-through text-red-400 text-xs">{valorActual || <em className="text-muted-foreground">vacío</em>}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          </>
        ) : null}

        {editando ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              className="h-7 text-sm py-0"
              value={temp}
              onChange={e => setTemp(e.target.value)}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') confirmarEdicion(); if (e.key === 'Escape') cancelarEdicion(); }}
            />
            <button onClick={confirmarEdicion} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
            <button onClick={cancelarEdicion} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`font-medium ${fueEditado ? 'text-blue-700' : 'text-green-700'}`}>
              {String(valorFinal)}
            </span>
            {fueEditado && <span className="text-xs text-blue-500">(editado)</span>}
            <button
              onClick={iniciarEdicion}
              className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity"
              title="Editar valor"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RevisionSolicitudesSaludDialog({ open, onClose, solicitudes, beneficiarios }) {
  const queryClient = useQueryClient();
  const [procesando, setProcesando] = useState(null);
  // editedValues por solicitud: { [solicitudId]: { [fieldKey]: valorEditado } }
  const [editedMap, setEditedMap] = useState({});

  const getEditedValues = (solId) => editedMap[solId] || {};
  const setEditedValues = (solId) => (updater) => {
    setEditedMap(prev => ({
      ...prev,
      [solId]: typeof updater === 'function' ? updater(prev[solId] || {}) : updater,
    }));
  };

  const aprobarMutation = useMutation({
    mutationFn: async ({ solicitud, datosFinales }) => {
      await base44.entities.Beneficiario.update(solicitud.beneficiario_id, datosFinales);
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

  const handleAprobar = (sol) => {
    const editedValues = getEditedValues(sol.id);
    // Merge datos_propuestos con los valores editados por el admin
    const datosFinales = { ...sol.datos_propuestos };
    Object.entries(editedValues).forEach(([k, v]) => { datosFinales[k] = v; });
    setProcesando(sol.id);
    aprobarMutation.mutate({ solicitud: sol, datosFinales });
  };

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
              const editedValues = getEditedValues(sol.id);

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

                  <p className="text-xs text-muted-foreground italic">
                    Podés editar cualquier valor antes de aprobar haciendo clic en el lápiz ✏️
                  </p>

                  {/* Comparativa campo por campo con edición inline */}
                  <div className="space-y-1.5">
                    {campos.map(([key, valorNuevo]) => (
                      <CampoEditable
                        key={key}
                        fieldKey={key}
                        valorNuevo={valorNuevo}
                        valorActual={ben?.[key] || ''}
                        editedValues={editedValues}
                        setEditedValues={setEditedValues(sol.id)}
                      />
                    ))}
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
                      onClick={() => handleAprobar(sol)}
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