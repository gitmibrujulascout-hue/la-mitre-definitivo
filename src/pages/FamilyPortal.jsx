import { Link,Navigate } from 'react-router-dom';
import PublicHeader from '@/components/public/PublicHeader';
import { useAuth } from '@/lib/AuthContext';
export default function FamilyPortal(){
 const {user,isLoadingAuth,loginWithGoogle}=useAuth();
 if(isLoadingAuth)return <main className="p-8" role="status">Comprobando la sesión…</main>;
 if(user?.tenant_id)return <Navigate to="/mi-grupo" replace/>;
 return <main className="brujula-public min-h-screen"><PublicHeader/><section className="mx-auto max-w-md space-y-5 px-5 py-12"><h1 className="text-2xl font-extrabold">Portal para familias</h1><p>El administrador o el jefe de rama debe habilitar tu cuenta y confirmar el vínculo con tus hijos.</p>{!user&&<button className="brujula-primary-action min-h-12 w-full" onClick={()=>loginWithGoogle(window.location.href)}>Ingresar con Google</button>}<p>No se otorga acceso automáticamente por apellido ni por conocer los datos del menor.</p><Link className="inline-flex min-h-11 items-center underline" to="/">Volver al inicio</Link></section></main>;
}
