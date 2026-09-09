import { z } from 'zod';
export const SCHOLARSHIP_BRANCHES = ['Lobatos', 'Tropa', 'KM', 'Rovers'];
export const policySchema = z.array(z.enum(SCHOLARSHIP_BRANCHES)).max(4);
export function effectiveScholarship(member, branches = []) {
  if (member.beca_override === true || member.beca_override === false) return member.beca_override;
  return member.tipo !== 'Voluntario' && policySchema.parse(branches).includes(member.rama);
}
export function scholarshipWrite(values) {
  const patch = { ...values };
  if (Object.hasOwn(patch, 'beca_override')) {
    z.boolean().nullable().parse(patch.beca_override);
    delete patch.becado;
  } else if (Object.hasOwn(patch, 'becado')) {
    patch.beca_override = z.boolean().parse(patch.becado);
    delete patch.becado;
  }
  return patch;
}
