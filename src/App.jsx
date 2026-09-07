import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import SuperAdminLayout from '@/components/layout/SuperAdminLayout';
import Dashboard from '@/pages/Dashboard';
import Beneficiarios from '@/pages/Beneficiarios';
import Pagos from '@/pages/Pagos';
import Gastos from '@/pages/Gastos';
import Campamentos from '@/pages/Campamentos';
import CuentaCorriente from '@/pages/CuentaCorriente';
import Caja from '@/pages/Caja';
import ActividadesEconomicas from '@/pages/ActividadesEconomicas';
import Tienda from '@/pages/Tienda';
import ConfiguracionCuotas from '@/pages/ConfiguracionCuotas';
import EstadoCuenta from '@/pages/EstadoCuenta';
import ReportePagos from '@/pages/ReportePagos';
import Afiliaciones from '@/pages/Afiliaciones';
import AgenteScout from '@/pages/AgenteScout';
import ReporteBeneficiarios from '@/pages/ReporteBeneficiarios';
import DirectorioEmergencias from '@/pages/DirectorioEmergencias';
import ConsultasFamilias from '@/pages/ConsultasFamilias';
import ReporteCreditos from '@/pages/ReporteCreditos';
import FichaEmergencia from '@/pages/FichaEmergencia.jsx';
import CampamentoPublico from '@/pages/CampamentoPublico';
import Login from '@/pages/Login';
import SuperAdmin from '@/pages/SuperAdmin';
import Landing from '@/pages/Landing';
import AcceptInvitation from '@/pages/AcceptInvitation';
import NoAccess from '@/pages/NoAccess';
import UsersPermissions from '@/pages/UsersPermissions';
import FamilyPortal from '@/pages/FamilyPortal';
import ResetPassword from '@/pages/ResetPassword';
import PermissionRoute from '@/components/access/PermissionRoute';
import { canAccessAdministration, getAuthenticatedHome } from '@/services/access/authDestination';
import { PERMISSIONS } from '@/services/access/permissions';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, user } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError && !user) {
    return <UserNotRegisteredError />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessAdministration(user)) return <Navigate to="/sin-acceso" replace />;

  // Render the main app (admin only)
  return (
    <Routes>
      <Route path="/app/administracion/inicio" element={<Navigate to={getAuthenticatedHome(user)} replace />} />
      <Route element={<AppLayout />}>
        <Route path="/app" element={<PermissionRoute permission={PERMISSIONS.dashboardView}><Dashboard /></PermissionRoute>} />
        <Route path="/beneficiarios" element={<PermissionRoute permission={PERMISSIONS.membersManage}><Beneficiarios /></PermissionRoute>} />
        <Route path="/pagos" element={<PermissionRoute permission={PERMISSIONS.paymentsManage}><Pagos /></PermissionRoute>} />
        <Route path="/gastos" element={<PermissionRoute permission={PERMISSIONS.expensesManage}><Gastos /></PermissionRoute>} />
        <Route path="/campamentos" element={<PermissionRoute permission={PERMISSIONS.campsManage}><Campamentos /></PermissionRoute>} />
        <Route path="/cuenta-corriente" element={<PermissionRoute permission={PERMISSIONS.accountsManage}><CuentaCorriente /></PermissionRoute>} />
        <Route path="/caja" element={<PermissionRoute permission={PERMISSIONS.cashManage}><Caja /></PermissionRoute>} />
        <Route path="/tienda" element={<PermissionRoute permission={PERMISSIONS.storeManage}><Tienda /></PermissionRoute>} />
        <Route path="/config-cuotas" element={<PermissionRoute permission={PERMISSIONS.feesManage}><ConfiguracionCuotas /></PermissionRoute>} />
        <Route path="/actividades" element={<PermissionRoute permission={PERMISSIONS.fundraisingManage}><ActividadesEconomicas /></PermissionRoute>} />
        <Route path="/reporte-pagos" element={<PermissionRoute permission={PERMISSIONS.reportsView}><ReportePagos /></PermissionRoute>} />
        <Route path="/reporte-creditos" element={<PermissionRoute permission={PERMISSIONS.reportsView}><ReporteCreditos /></PermissionRoute>} />
        <Route path="/afiliaciones" element={<PermissionRoute permission={PERMISSIONS.affiliationsManage}><Afiliaciones /></PermissionRoute>} />
        <Route path="/agente-scout" element={<PermissionRoute permission={PERMISSIONS.assistantUse}><AgenteScout /></PermissionRoute>} />
        <Route path="/reporte-beneficiarios" element={<PermissionRoute permission={PERMISSIONS.reportsView}><ReporteBeneficiarios /></PermissionRoute>} />
        <Route path="/directorio-emergencias" element={<PermissionRoute permission={PERMISSIONS.emergencyView}><DirectorioEmergencias /></PermissionRoute>} />
        <Route path="/consultas-familias" element={<PermissionRoute permission={PERMISSIONS.familyQueriesView}><ConsultasFamilias /></PermissionRoute>} />
        <Route path="/usuarios" element={<PermissionRoute permission={PERMISSIONS.usersManage}><UsersPermissions /></PermissionRoute>} />
      </Route>
      <Route element={user.is_super_admin ? <SuperAdminLayout /> : <Navigate to="/app" replace />}>
        <Route path="/super-admin" element={<SuperAdmin />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/aceptar-invitacion" element={<AcceptInvitation />} />
            <Route path="/sin-acceso" element={<NoAccess />} />
            <Route path="/familias" element={<FamilyPortal />} />
            <Route path="/restablecer-contrasena" element={<ResetPassword />} />
            <Route path="/estado-cuenta" element={<EstadoCuenta />} />
            <Route path="/ficha-emergencia" element={<FichaEmergencia />} />
            <Route path="/campamento/:codigo" element={<CampamentoPublico />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
