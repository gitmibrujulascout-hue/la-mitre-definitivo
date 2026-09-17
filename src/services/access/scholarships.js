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

export function scholarshipPercentage(member, onDate, concept='fee', activityId=null) {
  const matching=(member.scholarship_periods||[]).filter(s=>s.concept===concept&&s.starts_on<=onDate&&s.ends_on>=onDate&&(concept==='fee'||s.activity_id===activityId));
  const selected=matching.find(s=>s.member_id===member.id)||matching.find(s=>s.branch===member.rama);
  if(selected)return Math.max(0,Math.min(100,Number(selected.percentage)||0));
  return concept==='fee'&&(member.legacy_becado??member.becado)?100:0;
}
export function applyPeriodScholarship(amount,member,onDate,concept='fee',activityId=null){
  return Math.round(Number(amount)*(100-scholarshipPercentage(member,onDate,concept,activityId)))/100;
}
