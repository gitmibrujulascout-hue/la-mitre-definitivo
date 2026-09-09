import { SCHOLARSHIP_BRANCHES } from '@/services/access/scholarships';
export default function BranchScopeSelector({ branches, onChange, disabled = false }) {
  return <fieldset disabled={disabled} className="space-y-3"><legend className="font-semibold">Ramas que puede consultar</legend><p className="text-sm text-muted-foreground">Solo verá datos básicos y contactos de emergencia de estas ramas.</p><div className="grid grid-cols-2 gap-3">{SCHOLARSHIP_BRANCHES.map(branch => <label key={branch} className="flex min-h-11 items-center gap-3 rounded border p-3"><input type="checkbox" checked={branches.includes(branch)} onChange={e => onChange(e.target.checked ? [...branches,branch] : branches.filter(item => item !== branch))}/>{branch}</label>)}</div></fieldset>;
}
