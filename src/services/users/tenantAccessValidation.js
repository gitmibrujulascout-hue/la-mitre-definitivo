import { z } from 'zod';
import { isValidTenantRole } from '../access/permissions.js';

const roleSchema = z.string().refine(isValidTenantRole, 'Rol no válido.');

export const invitationInputSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresá el nombre de la persona.'),
  email: z.string().trim().toLowerCase().email('Ingresá un email válido.'),
  roles: z.array(roleSchema).min(1, 'Elegí al menos un rol.')
});

export const roleUpdateSchema = z.array(roleSchema).min(1, 'Elegí al menos un rol.');

export const invitationTokenSchema = z.string().trim().regex(
  /^[a-f0-9]{64}$/i,
  'El enlace de invitación no es válido.'
);

export const invitationAccountSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresá un email válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.')
});

export function fieldErrorsFor(result) {
  if (result.success) return {};
  return result.error.issues.reduce((errors, issue) => {
    const field = String(issue.path[0] || 'form');
    if (!errors[field]) errors[field] = issue.message;
    return errors;
  }, {});
}
