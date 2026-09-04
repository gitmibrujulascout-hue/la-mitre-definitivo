import { Grid2X2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandLogo } from './BrujulaBrand';

export default function PublicHeader() {
  return (
    <header className="brujula-public-header">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-10">
        <Link to="/" className="focus-ring rounded-md" aria-label="Ir al inicio de Brújula">
          <BrandLogo markClassName="h-8 w-8" />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium sm:gap-6" aria-label="Navegación pública">
          <a className="brujula-public-nav-link hidden items-center gap-1.5 md:inline-flex" href="/#vista">
            <Grid2X2 className="h-4 w-4" aria-hidden="true" />
            Vista rápida
          </a>
          <a className="brujula-public-nav-link hidden sm:inline-flex" href="/#fondo">Fondo</a>
          <Link className="brujula-public-nav-link" to="/login">Ingresar</Link>
          <Link
            className="brujula-primary-action min-h-11 px-4"
            to="/login?accion=registrar-grupo"
            title="Ingresá con una cuenta autorizada para registrar el grupo"
          >
            <span className="sm:hidden">Registrar</span>
            <span className="hidden sm:inline">Registrar grupo</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
