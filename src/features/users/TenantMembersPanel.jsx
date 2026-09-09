import { Ban, CheckCircle2, Pencil, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { roleLabel } from '@/services/access/permissions';

export default function TenantMembersPanel({
  members,
  currentUserId,
  busyUserId,
  onEdit,
  onStatusChange
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" aria-hidden="true" />
          Usuarios activos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-semibold">Todavía no hay usuarios asignados.</p>
            <p className="mt-1 text-sm text-muted-foreground">Creá una invitación para sumar al primero.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const isCurrentUser = member.userId === currentUserId;
              const isSuspended = member.status === 'suspended';
              return (
                <article key={member.userId} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold">{member.fullName}</h3>
                        {isCurrentUser && <Badge variant="outline">Tu cuenta</Badge>}
                        <Badge variant={isSuspended ? 'destructive' : 'secondary'}>
                          {isSuspended ? 'Suspendido' : 'Activo'}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {member.email || 'Email no disponible hasta actualizar la base'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(member.branches || []).map(branch => <Badge key={branch} variant="secondary">{branch}</Badge>)}
                        {member.roles.map((role) => (
                          <Badge key={role} variant="outline">{roleLabel(role)}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => onEdit(member)}
                        disabled={busyUserId === member.userId}
                      >
                        <Pencil aria-hidden="true" />
                        Editar roles
                      </Button>
                      {!isCurrentUser && (
                        <Button
                          type="button"
                          variant={isSuspended ? 'secondary' : 'outline'}
                          className="min-h-11"
                          onClick={() => onStatusChange(member, isSuspended ? 'active' : 'suspended')}
                          disabled={busyUserId === member.userId}
                        >
                          {isSuspended
                            ? <CheckCircle2 aria-hidden="true" />
                            : <Ban aria-hidden="true" />}
                          {isSuspended ? 'Reactivar' : 'Suspender'}
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
