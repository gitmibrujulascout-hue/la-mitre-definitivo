import { Check } from 'lucide-react';
import { TENANT_ROLE_OPTIONS } from '@/services/access/permissions';
import { cn } from '@/lib/utils';

export default function RoleSelector({ roles, onChange, disabled = false, idPrefix = 'role' }) {
  const selectedRoles = Array.isArray(roles) ? roles : [];

  const toggleRole = (role) => {
    if (disabled) return;
    const nextRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((selected) => selected !== role)
      : [...selectedRoles, role];
    onChange(nextRoles);
  };

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-3 text-sm font-semibold">Roles y responsabilidades</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {TENANT_ROLE_OPTIONS.map((option) => {
          const checked = selectedRoles.includes(option.value);
          const inputId = `${idPrefix}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={cn(
                'flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                checked ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent/60',
                disabled && 'cursor-not-allowed opacity-60'
              )}
            >
              <span className={cn(
                'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border',
                checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'
              )}>
                {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              </span>
              <span>
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
              </span>
              <input
                id={inputId}
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => toggleRole(option.value)}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

