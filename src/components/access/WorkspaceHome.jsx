import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { hasPermission, PERMISSIONS, ROUTE_PERMISSIONS } from '@/services/access/permissions';
import Dashboard from '@/pages/Dashboard';
const labels = { '/beneficiarios':'Personas', '/campamentos':'Campamentos','/usuarios':'Usuarios y permisos','/config-cuotas':'Cuotas y becas','/mi-rama':'Mis ramas','/directorio-emergencias':'Emergencias','/reporte-beneficiarios':'Reporte de personas','/afiliaciones':'Afiliaciones','/consultas-familias':'Consultas de familias' };
export default function WorkspaceHome() {
  const { user } = useAuth();
  if(hasPermission(user,PERMISSIONS.cashManage)) return <Dashboard/>;
  return <div className="space-y-5"><h1 className="text-2xl font-bold">{user?.tenant?.name || 'Mi grupo'}</h1><p>Estas son las herramientas habilitadas para tus responsabilidades.</p><div className="grid gap-4 sm:grid-cols-2">{Object.entries(labels).filter(([path]) => hasPermission(user,ROUTE_PERMISSIONS[path])).map(([path,label]) => <Link className="min-h-16 rounded border p-5 bg-card focus-visible:outline" key={path} to={path}>{label}</Link>)}</div></div>;
}
