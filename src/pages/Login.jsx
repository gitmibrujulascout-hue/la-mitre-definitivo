import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/" replace />;
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try { await login(email, password); navigate('/'); }
    catch (err) { setError(err.message || 'No se pudo iniciar sesión.'); }
    finally { setLoading(false); }
  };
  return <AuthLayout icon={LogIn} title="Mi Brújula Scout" subtitle="Ingresá al panel administrativo">
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">Email<input className="mt-1 w-full rounded-md border p-2" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label className="block text-sm font-medium">Contraseña<input className="mt-1 w-full rounded-md border p-2" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
    </form>
  </AuthLayout>;
}
