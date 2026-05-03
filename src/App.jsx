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
import EstadoCuenta from '@/pages/EstadoCuenta';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
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
        <Route path="/actividades" element={<ActividadesEconomicas />} />
      </Route>
      <Route path="/estado-cuenta" element={<EstadoCuenta />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App