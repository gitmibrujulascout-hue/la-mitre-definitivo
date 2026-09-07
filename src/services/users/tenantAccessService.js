import { supabase } from '@/api/supabaseClient';
import { normalizeTenantRoles } from '@/services/access/permissions';
import {
  invitationInputSchema,
  invitationTokenSchema,
  roleUpdateSchema
} from './tenantAccessValidation';

export async function listTenantAccess(tenantId) {
  if (!tenantId) return { members: [], invitations: [], setupRequired: false };

  const membershipResult = await loadMemberships(tenantId);
  if (membershipResult.error) throw new Error('No pudimos cargar los usuarios del grupo.');

  const memberships = membershipResult.data || [];
  const userIds = memberships.map((membership) => membership.user_id);
  const [rolesResult, profilesResult, invitationsResult] = await Promise.all([
    loadRoles(tenantId),
    loadProfiles(userIds),
    loadInvitations(tenantId)
  ]);

  const rolesByUser = new Map();
  if (!rolesResult.error) {
    for (const row of rolesResult.data || []) {
      const current = rolesByUser.get(row.user_id) || [];
      current.push(row.role);
      rolesByUser.set(row.user_id, current);
    }
  }

  const profilesById = new Map((profilesResult.data || []).map((profile) => [profile.id, profile]));
  const members = memberships.map((membership) => {
    const profile = profilesById.get(membership.user_id) || {};
    return {
      id: membership.id,
      userId: membership.user_id,
      tenantId: membership.tenant_id,
      fullName: profile.full_name || 'Usuario sin nombre',
      email: profile.email || '',
      status: membership.status || 'active',
      roles: normalizeTenantRoles(rolesByUser.get(membership.user_id), membership.role),
      createdAt: membership.created_at
    };
  });

  return {
    members,
    invitations: invitationsResult.error ? [] : (invitationsResult.data || []).map(mapInvitation),
    setupRequired: Boolean(rolesResult.error || invitationsResult.error)
  };
}

export async function createTenantInvitation(tenantId, input, origin = window.location.origin) {
  const parsed = invitationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, validationError: parsed.error };

  const { data, error } = await supabase.rpc('create_tenant_invitation', {
    target_tenant_id: tenantId,
    invitation_email: parsed.data.email,
    invitation_full_name: parsed.data.fullName,
    invitation_roles: parsed.data.roles
  });
  if (error) return { ok: false, message: accessErrorMessage(error) };

  const result = firstRpcRow(data);
  if (!result?.invitation_token) {
    return { ok: false, message: 'No pudimos crear el enlace de invitación.' };
  }

  const url = new URL('/aceptar-invitacion', origin);
  url.searchParams.set('token', result.invitation_token);
  return {
    ok: true,
    invitationId: result.invitation_id,
    expiresAt: result.invitation_expires_at,
    url: url.toString()
  };
}

export async function updateTenantMemberRoles(tenantId, userId, roles) {
  const parsed = roleUpdateSchema.safeParse(roles);
  if (!parsed.success) return { ok: false, validationError: parsed.error };

  const { error } = await supabase.rpc('set_tenant_member_roles', {
    target_tenant_id: tenantId,
    target_user_id: userId,
    requested_roles: parsed.data
  });
  return error
    ? { ok: false, message: accessErrorMessage(error) }
    : { ok: true };
}

export async function updateTenantMemberStatus(tenantId, userId, status) {
  if (!['active', 'suspended'].includes(status)) {
    return { ok: false, message: 'El estado solicitado no es válido.' };
  }
  const { error } = await supabase.rpc('set_tenant_member_status', {
    target_tenant_id: tenantId,
    target_user_id: userId,
    requested_status: status
  });
  return error
    ? { ok: false, message: accessErrorMessage(error) }
    : { ok: true };
}

export async function cancelTenantInvitation(invitationId) {
  const { error } = await supabase.rpc('cancel_tenant_invitation', {
    invitation_id: invitationId
  });
  return error
    ? { ok: false, message: accessErrorMessage(error) }
    : { ok: true };
}

export async function getTenantInvitation(token) {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { data, error } = await supabase.rpc('get_tenant_invitation', {
    invitation_token: parsed.data
  });
  if (error) return { ok: false, message: 'No pudimos verificar esta invitación.' };

  const invitation = firstRpcRow(data);
  if (!invitation) return { ok: false, message: 'La invitación no existe o ya no está disponible.' };
  return {
    ok: true,
    invitation: {
      status: invitation.invitation_status,
      email: invitation.invitation_email,
      fullName: invitation.invitation_full_name,
      roles: invitation.invitation_roles || [],
      tenantName: invitation.tenant_name,
      expiresAt: invitation.invitation_expires_at
    }
  };
}

export async function acceptTenantInvitation(token) {
  const parsed = invitationTokenSchema.safeParse(token);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { data, error } = await supabase.rpc('accept_tenant_invitation', {
    invitation_token: parsed.data
  });
  return error
    ? { ok: false, message: accessErrorMessage(error) }
    : { ok: true, tenantId: data };
}

async function loadMemberships(tenantId) {
  const extended = await supabase
    .from('tenant_memberships')
    .select('id, tenant_id, user_id, role, status, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });
  if (!extended.error) return extended;

  return supabase
    .from('tenant_memberships')
    .select('id, tenant_id, user_id, role, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });
}

function loadRoles(tenantId) {
  return supabase
    .from('tenant_membership_roles')
    .select('tenant_id, user_id, role')
    .eq('tenant_id', tenantId);
}

async function loadProfiles(userIds) {
  if (!userIds.length) return { data: [], error: null };
  const extended = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);
  if (!extended.error) return extended;
  return supabase.from('profiles').select('id, full_name').in('id', userIds);
}

function loadInvitations(tenantId) {
  return supabase
    .from('tenant_invitations')
    .select('id, tenant_id, email, full_name, roles, status, expires_at, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
}

function mapInvitation(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    fullName: row.full_name,
    roles: row.roles || [],
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

function firstRpcRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

function accessErrorMessage(error) {
  const message = String(error?.message || '');
  if (message.includes('LAST_TENANT_ADMIN')) {
    return 'El grupo debe conservar al menos un administrador activo.';
  }
  if (message.includes('SELF_ROLE_CHANGE_NOT_ALLOWED')) {
    return 'Por seguridad, no podés cambiar tus propios roles.';
  }
  if (message.includes('SELF_STATUS_CHANGE_NOT_ALLOWED')) {
    return 'Por seguridad, no podés suspender tu propio acceso.';
  }
  if (message.includes('INVITATION_EMAIL_MISMATCH')) {
    return 'Esta invitación pertenece a otra dirección de email.';
  }
  if (message.includes('INVITATION_NOT_AVAILABLE')) {
    return 'La invitación venció, fue cancelada o ya se utilizó.';
  }
  if (message.includes('TENANT_ADMIN_REQUIRED')) {
    return 'Sólo otro administrador puede otorgar acceso de administrador.';
  }
  if (message.includes('ACCESS_DENIED')) {
    return 'No tenés permiso para realizar esta acción.';
  }
  return 'No pudimos completar la operación. Intentá nuevamente.';
}

