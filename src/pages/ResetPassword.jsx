import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from '@/components/public/PublicHeader';
import { supabase } from '@/api/supabaseClient';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('request');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const requestReset = async (event) => {
    event.preventDefault(); setLoading(true); setError(''); setMessage('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/restablecer-contrasena`
    });
    if (resetError) setError('No pudimos enviar el enlace. Revisá el email e intentá nuevamente.');
    else setMessage('Si el email está registrado, recibirás un enlace para cambiar la contraseña.');
    setLoading(false);
  };

  const updatePassword = async (event) => {
    event.preventDefault(); setLoading(true); setError(''); setMessage('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); setLoading(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError('El enlace venció o ya fue utilizado. Solicitá uno nuevo.');
    else { setMessage('Contraseña actualizada correctamente.'); setMode('done'); }
    setLoading(false);
  };

  return <main className="brujula-public min-h-screen"><PublicHeader /><section className="brujula-auth-page flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-5 py-12"><div className="brujula-auth-card w-full max-w-md p-6 sm:p-8">
    {mode === 'request' && <><h1 className="text-2xl font-extrabold">Recuperar contraseña</h1><p className="brujula-auth-copy mt-2 text-sm">Te enviaremos un enlace seguro a tu email.</p><form onSubmit={requestReset} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Email<input className="brujula-auth-input mt-2 w-full" type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><button className="brujula-primary-action min-h-12 w-full" disabled={loading}>{loading ? 'Enviando…' : 'Enviar enlace'}</button></form></>}
    {mode === 'update' && <><h1 className="text-2xl font-extrabold">Nueva contraseña</h1><form onSubmit={updatePassword} className="mt-6 space-y-4"><label className="block text-sm font-semibold">Contraseña nueva<input className="brujula-auth-input mt-2 w-full" type="password" minLength="8" value={password} onChange={e => setPassword(e.target.value)} required /></label><button className="brujula-primary-action min-h-12 w-full" disabled={loading}>{loading ? 'Guardando…' : 'Cambiar contraseña'}</button></form></>}
    {mode === 'done' && <><h1 className="text-2xl font-extrabold">Contraseña actualizada</h1><p className="mt-3 text-sm">Ya podés ingresar con tu nueva contraseña.</p></>}
    {error && <p className="brujula-auth-error mt-4 text-sm" role="alert">{error}</p>}{message && <p className="brujula-auth-notice mt-4 text-sm" role="status">{message}</p>}<Link className="brujula-auth-link mt-6 inline-block" to="/login">Volver a ingresar</Link>
  </div></section></main>;
}
