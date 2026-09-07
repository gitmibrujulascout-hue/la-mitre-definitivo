import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission } from '@/services/access/permissions';

export default function PermissionRoute({ permission, children }) {
  const { user } = useAuth();
  if (hasPermission(user, permission)) return children;

  return (
    <Card className="mx-auto mt-8 max-w-xl">
      <CardContent className="p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <ShieldAlert aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">No tenés permiso para entrar acá</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Esta sección no forma parte de tus responsabilidades actuales. Si necesitás acceder, pedile a un administrador que revise tus roles.
        </p>
        <Button asChild className="mt-6 min-h-11">
          <Link to="/app"><ArrowLeft aria-hidden="true" />Volver al panel</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

