import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Copy, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import RoleSelector from '@/features/users/RoleSelector';
import TenantInvitationsPanel from '@/features/users/TenantInvitationsPanel';
import TenantMembersPanel from '@/features/users/TenantMembersPanel';
import { useAuth } from '@/lib/AuthContext';
import {
  cancelTenantInvitation,
  createTenantInvitation,
  listTenantAccess,
  updateTenantMemberRoles,
  updateTenantMemberStatus
} from '@/services/users/tenantAccessService';
import {
  fieldErrorsFor,
  invitationInputSchema
} from '@/services/users/tenantAccessValidation';

const EMPTY_FORM = Object.freeze({ fullName: '', email: '', roles: ['administration'] });

export default function UsersPermissions() {
  const { user } = useAuth();
  const nameRef = useRef(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [editingRoles, setEditingRoles] = useState([]);
  const [busyUserId, setBusyUserId] = useState('');
  const [busyInvitationId, setBusyInvitationId] = useState('');

  const loadAccess = useCallback(async () => {
    if (!user?.tenant_id) {
      setLoading(false);
      setLoadError('Tu cuenta no tiene un tenant activo.');
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const result = await listTenantAccess(user.tenant_id);
      setMembers(result.members);
      setInvitations(result.invitations);
      setSetupRequired(result.setupRequired);
    } catch {
      setLoadError('No pudimos cargar los accesos. Revisá la conexión e intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [user?.tenant_id]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const submitInvitation = async (event) => {
    event.preventDefault();
    setStatus(null);
    setShareUrl('');
    const parsed = invitationInputSchema.safeParse(form);
    if (!parsed.success) {
      const errors = fieldErrorsFor(parsed);
      setFieldErrors(errors);
      nameRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setCreating(true);
    const result = await createTenantInvitation(user.tenant_id, parsed.data);
    setCreating(false);
    if (!result.ok) {
      setStatus({ type: 'error', text: result.message || 'Revisá los datos de la invitación.' });
      return;
    }

    setForm(EMPTY_FORM);
    setShareUrl(result.url);
    setStatus({ type: 'success', text: 'Invitación creada. Copiá el enlace y compartilo con la persona.' });
    await loadAccess();
  };

  const saveMemberRoles = async () => {
    if (!editingMember) return;
    setBusyUserId(editingMember.userId);
    const result = await updateTenantMemberRoles(user.tenant_id, editingMember.userId, editingRoles);
    setBusyUserId('');
    if (!result.ok) {
      setStatus({ type: 'error', text: result.message || 'No pudimos actualizar los roles.' });
      return;
    }
    setEditingMember(null);
    setStatus({ type: 'success', text: 'Roles actualizados correctamente.' });
    await loadAccess();
  };

  const changeMemberStatus = async (member, nextStatus) => {
    setBusyUserId(member.userId);
    const result = await updateTenantMemberStatus(user.tenant_id, member.userId, nextStatus);
    setBusyUserId('');
    setStatus(result.ok
      ? { type: 'success', text: nextStatus === 'active' ? 'Usuario reactivado.' : 'Usuario suspendido.' }
      : { type: 'error', text: result.message || 'No pudimos cambiar el acceso.' });
    if (result.ok) await loadAccess();
  };

  const cancelInvitation = async (invitation) => {
    setBusyInvitationId(invitation.id);
    const result = await cancelTenantInvitation(invitation.id);
    setBusyInvitationId('');
    setStatus(result.ok
      ? { type: 'success', text: 'Invitación cancelada.' }
      : { type: 'error', text: result.message || 'No pudimos cancelar la invitación.' });
    if (result.ok) await loadAccess();
  };

  const copyInvitation = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus({ type: 'success', text: 'Enlace copiado.' });
    } catch {
      setStatus({ type: 'error', text: 'No pudimos copiarlo automáticamente. Seleccioná el enlace y copialo.' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Usuarios y permisos"
        description={`Administrá quién puede ingresar a ${user?.tenant?.name || 'este tenant'} y qué puede hacer.`}
      >
        <Button variant="outline" className="min-h-11" onClick={() => void loadAccess()} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Actualizar
        </Button>
      </PageHeader>

      {status && (
        <Alert className="mb-6" variant={status.type === 'error' ? 'destructive' : 'default'}>
          {status.type === 'error'
            ? <AlertCircle aria-hidden="true" />
            : <CheckCircle2 aria-hidden="true" />}
          <AlertTitle>{status.type === 'error' ? 'No se pudo completar' : 'Listo'}</AlertTitle>
          <AlertDescription>{status.text}</AlertDescription>
        </Alert>
      )}

      {setupRequired && (
        <Alert className="mb-6">
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Actualización de seguridad pendiente</AlertTitle>
          <AlertDescription>
            Podés consultar los accesos actuales, pero las invitaciones se habilitarán al publicar la nueva configuración de seguridad.
          </AlertDescription>
        </Alert>
      )}

      {loadError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="mt-3 font-semibold">{loadError}</p>
            <Button className="mt-4" onClick={() => void loadAccess()}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" aria-hidden="true" />
                Invitar una persona
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={submitInvitation} noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="invitation-name"
                    label="Nombre completo"
                    value={form.fullName}
                    error={fieldErrors.fullName}
                    inputRef={nameRef}
                    onChange={(fullName) => setForm((current) => ({ ...current, fullName }))}
                  />
                  <Field
                    id="invitation-email"
                    label="Email"
                    type="email"
                    value={form.email}
                    error={fieldErrors.email}
                    onChange={(email) => setForm((current) => ({ ...current, email }))}
                  />
                </div>
                <RoleSelector
                  idPrefix="invitation-role"
                  roles={form.roles}
                  onChange={(roles) => setForm((current) => ({ ...current, roles }))}
                  disabled={creating}
                />
                {fieldErrors.roles && <p className="text-sm text-destructive">{fieldErrors.roles}</p>}
                <Button type="submit" className="min-h-11" disabled={creating || setupRequired}>
                  <Send aria-hidden="true" />
                  {creating ? 'Creando…' : 'Crear invitación'}
                </Button>
              </form>

              {shareUrl && (
                <div className="mt-6 rounded-lg border border-primary/30 bg-primary/10 p-4">
                  <p className="font-semibold">Enlace de un solo uso</p>
                  <p className="mt-1 text-sm text-muted-foreground">Vence en 7 días. Por seguridad no podremos volver a mostrar este mismo enlace.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input value={shareUrl} readOnly aria-label="Enlace de invitación" />
                    <Button type="button" variant="outline" className="min-h-11" onClick={copyInvitation}>
                      <Copy aria-hidden="true" /> Copiar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {loading ? <AccessSkeleton /> : (
            <>
              <TenantMembersPanel
                members={members}
                currentUserId={user?.id}
                busyUserId={busyUserId}
                onEdit={(member) => {
                  setEditingMember(member);
                  setEditingRoles(member.roles);
                }}
                onStatusChange={changeMemberStatus}
              />
              <TenantInvitationsPanel
                invitations={invitations}
                busyInvitationId={busyInvitationId}
                onCancel={cancelInvitation}
              />
            </>
          )}
        </div>
      )}

      <Dialog open={Boolean(editingMember)} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar roles de {editingMember?.fullName}</DialogTitle>
          </DialogHeader>
          <RoleSelector idPrefix="member-role" roles={editingRoles} onChange={setEditingRoles} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>Cancelar</Button>
            <Button onClick={saveMemberRoles} disabled={!editingRoles.length || Boolean(busyUserId)}>
              {busyUserId ? 'Guardando…' : 'Guardar roles'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ id, label, type = 'text', value, error, inputRef, onChange }) {
  return (
    <label className="block text-sm font-semibold" htmlFor={id}>
      {label}
      <Input
        ref={inputRef}
        id={id}
        type={type}
        className="mt-2 min-h-11"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <span id={`${id}-error`} className="mt-1 block text-sm text-destructive">{error}</span>}
    </label>
  );
}

function AccessSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2" aria-label="Cargando usuarios">
      {[0, 1].map((item) => (
        <div key={item} className="h-48 animate-pulse rounded-xl border bg-muted/60" />
      ))}
    </div>
  );
}

