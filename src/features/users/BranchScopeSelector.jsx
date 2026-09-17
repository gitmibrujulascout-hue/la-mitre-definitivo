import { SCHOLARSHIP_BRANCHES } from '@/services/access/scholarships';
export default function BranchScopeSelector({ branches, onChange, disabled = false }) {
  return <fieldset disabled={disabled} className="space-y-3"><legend className="font-semibold">Rama a su cargo</legend><p className="text-sm text-muted-foreground">Un jefe dirige una única rama. Asigná las ayudantías adicionales en Mi grupo.</p><div className="grid grid-cols-2 gap-3">{SCHOLARSHIP_BRANCHES.map(branch => <label key={branch} className="flex min-h-11 items-center gap-3 rounded border p-3"><input type="radio" name="led-branch" checked={branches.includes(branch)} onChange={() => onChange([branch])}/>{branch}</label>)}</div></fieldset>;
}
