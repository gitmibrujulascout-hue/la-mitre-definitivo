import { Clock3, MailCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { roleLabel } from '@/services/access/permissions';

const STATUS_LABELS = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  cancelled: 'Cancelada',
  expired: 'Vencida'
};

export default function TenantInvitationsPanel({ invitations, busyInvitationId, onCancel }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          Invitaciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-semibold">No hay invitaciones todavía.</p>
            <p className="mt-1 text-sm text-muted-foreground">Los enlaces creados aparecerán acá.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <article key={invitation.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-bold">{invitation.fullName}</h3>
                      <Badge variant={invitation.status === 'pending' ? 'secondary' : 'outline'}>
                        {STATUS_LABELS[invitation.status] || invitation.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{invitation.email}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {invitation.roles.map((role) => (
                        <Badge key={role} variant="outline">{roleLabel(role)}</Badge>
                      ))}
                    </div>
                    {invitation.status === 'pending' && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        Vence {formatDate(invitation.expiresAt)}
                      </p>
                    )}
                  </div>
                  {invitation.status === 'pending' && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => onCancel(invitation)}
                      disabled={busyInvitationId === invitation.id}
                    >
                      <XCircle aria-hidden="true" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(value) {
  if (!value) return 'sin fecha';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}

