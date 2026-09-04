import { ArrowRight, CalendarDays, ShieldCheck, TreePine, Users, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: Users,
    title: 'Personas y familias',
    description: 'Legajos, ramas, contactos y toda la información del grupo en un mismo lugar.'
  },
  {
    icon: WalletCards,
    title: 'Finanzas claras',
    description: 'Cuotas, pagos, gastos, caja y banco con información ordenada y trazable.'
  },
  {
    icon: CalendarDays,
    title: 'Vida del grupo',
    description: 'Campamentos, actividades y organización cotidiana disponibles para el equipo.'
  }
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <TreePine className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <strong className="block text-sm font-bold leading-tight">Mi Brújula Scout</strong>
              <span className="text-xs text-muted-foreground">Gestión para grupos scouts</span>
            </span>
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Ingresar
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-sidebar-primary/15 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Plataforma de gestión scout</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight text-sidebar-primary-foreground sm:text-5xl lg:text-6xl">
              Tu grupo organizado, conectado y listo para crecer.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-sidebar-foreground/75">
              Mi Brújula Scout reúne personas, finanzas, actividades y campamentos en una plataforma simple para administrar el día a día.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                Iniciar sesión
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/estado-cuenta"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent px-6 font-semibold text-sidebar-accent-foreground transition hover:bg-sidebar-accent/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                Consultar estado de cuenta
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-6 shadow-2xl sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="font-bold text-sidebar-primary-foreground">Un espacio para cada grupo</p>
                <p className="text-sm text-sidebar-foreground/65">Información separada y protegida por tenant.</p>
              </div>
            </div>
            <div className="mt-7 grid gap-3">
              {['Configuración guiada', 'Roles y permisos', 'Carga progresiva de información'].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar/50 px-4 py-3 text-sm font-medium">
                  <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20" aria-labelledby="landing-features-title">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Todo en un mismo lugar</p>
          <h2 id="landing-features-title" className="mt-3 text-3xl font-extrabold sm:text-4xl">Una base sólida para empezar a trabajar.</h2>
        </div>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
