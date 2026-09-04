import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
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

  // Handle authentication errors
  if (authError && !user) return <UserNotRegisteredError />;

  // Non-admins AND unauthenticated visitors: only public pages (estado-cuenta, ficha-emergencia, campamento)
  if (!user || user.role !== 'admin') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/estado-cuenta" element={<EstadoCuenta />} />
        <Route path="/ficha-emergencia" element={<FichaEmergencia />} />
        <Route path="/campamento/:codigo" element={<CampamentoPublico />} />
        <Route path="*" element={<EstadoCuenta />} />
      </Routes>
    );
  }

  // Render the main app (admin only)
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/beneficiarios" element={<Beneficiarios />} />
        <Route path="/pagos" element={<Pagos />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/campamentos" element={<Campamentos />} />
        <Route path="/cuenta-corriente" element={<CuentaCorriente />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/tienda" element={<Tienda />} />
        <Route path="/config-cuotas" element={<ConfiguracionCuotas />} />
        <Route path="/actividades" element={<ActividadesEconomicas />} />
        <Route path="/reporte-pagos" element={<ReportePagos />} />
        <Route path="/reporte-creditos" element={<ReporteCreditos />} />
        <Route path="/afiliaciones" element={<Afiliaciones />} />
        <Route path="/agente-scout" element={<AgenteScout />} />
        <Route path="/reporte-beneficiarios" element={<ReporteBeneficiarios />} />
        <Route path="/directorio-emergencias" element={<DirectorioEmergencias />} />
        <Route path="/consultas-familias" element={<ConsultasFamilias />} />
        <Route path="/super-admin" element={<SuperAdmin />} />
      </Route>
      <Route path="/estado-cuenta" element={<EstadoCuenta />} />
      <Route path="/ficha-emergencia" element={<FichaEmergencia />} />
      <Route path="/campamento/:codigo" element={<CampamentoPublico />} />
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
