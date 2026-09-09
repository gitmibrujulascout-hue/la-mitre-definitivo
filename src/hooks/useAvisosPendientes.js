import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission, PERMISSIONS } from '@/services/access/permissions';

/**
 * Cuenta las aprobaciones / acciones pendientes del admin.
 *   - Pre-encargos de tienda en estado "Pendiente"
 *   - Solicitudes de cambio de ficha de salud en estado "Pendiente"
 */
export function useAvisosPendientes() {
  const { user } = useAuth();
  const { data: encargos = [] } = useQuery({
    queryKey: ['avisos-encargos'],
    enabled: hasPermission(user,PERMISSIONS.storeManage),
    queryFn: () => base44.entities.PreEncargoTienda.filter({ estado: 'Pendiente' }, '-fecha', 200),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const { data: solicitudes = [] } = useQuery({
    queryKey: ['avisos-solicitudes-salud'],
    enabled: hasPermission(user,PERMISSIONS.membersManage),
    queryFn: () => base44.entities.SolicitudCambioSalud.filter({ estado: 'Pendiente' }, '-created_date', 200),
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  const encargosPendientes = encargos.length;
  const solicitudesSaludPendientes = solicitudes.length;

  return {
    encargosPendientes,
    solicitudesSaludPendientes,
    total: encargosPendientes + solicitudesSaludPendientes,
    encargos,
    solicitudes,
  };
}
