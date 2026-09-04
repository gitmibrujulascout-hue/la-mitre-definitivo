import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckSquare2,
  CreditCard,
  HeartHandshake,
  Monitor,
  ShieldCheck,
  Users,
  WalletCards,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CompassSeal, CompassWatermark } from '@/components/public/BrujulaBrand';
import PublicHeader from '@/components/public/PublicHeader';

const quickAccess = [
  { icon: CreditCard, label: 'Cuotas' },
  { icon: BarChart3, label: 'Pagos' },
  { icon: HeartHandshake, label: 'Becas' },
  { icon: CheckSquare2, label: 'Asistencia' },
  { icon: CalendarDays, label: 'Calendario' }
];

const platformHighlights = [
  {
    icon: Users,
    title: 'Personas y familias',
    description: 'La información del grupo, organizada en un mismo espacio.'
  },
  {
    icon: WalletCards,
    title: 'Finanzas claras',
    description: 'Cuotas, pagos, gastos, caja y banco con trazabilidad.'
  },
  {
    icon: ShieldCheck,
    title: 'Cada grupo protegido',
    description: 'Espacios separados por organización y permisos por rol.'
  }
];

export default function Landing() {
  return (
    <main className="brujula-public min-h-screen">
      <PublicHeader />

      <section className="brujula-hero relative overflow-hidden">
        <CompassWatermark className="-right-52 top-1/2 hidden h-[760px] w-[760px] -translate-y-1/2 opacity-[0.055] lg:block" />
        <div className="relative z-10 mx-auto grid min-h-[calc(100svh-3.5rem)] max-w-7xl items-center gap-10 px-5 py-12 sm:px-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:py-9">
          <div className="max-w-3xl">
            <p className="brujula-eyebrow inline-flex items-center gap-2.5">
              <span className="h-px w-4 bg-current" aria-hidden="true" />
              Plataforma para grupos scouts · Argentina
            </p>

            <h1 className="brujula-hero-heading mt-5 max-w-2xl text-5xl font-semibold leading-[0.98] sm:text-6xl">
              Ordena, conecta y <span className="brujula-emphasis">hace crecer</span> a tu grupo.
            </h1>

            <p className="brujula-hero-lead mt-6 max-w-xl text-lg font-semibold leading-7 sm:text-xl">
              Brújula reúne la administración, las finanzas y el día a día de tu grupo scout en un solo lugar.
            </p>
            <p className="brujula-hero-copy mt-4 max-w-lg text-sm leading-6 sm:text-base">
              Administración clara, finanzas transparentes y herramientas pensadas para fortalecer a la comunidad.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="brujula-primary-action min-h-12 px-5" to="/login">
                Iniciar sesión
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                className="brujula-secondary-action min-h-12 px-5"
                to="/login?accion=registrar-grupo"
                title="Ingresá con una cuenta autorizada para registrar el grupo"
              >
                Registrar grupo
              </Link>
            </div>

            <div id="vista" className="brujula-quick-access mt-7 border-t pt-5">
              <p className="brujula-quick-label mb-3 inline-flex items-center gap-2">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                Accesos directos · un toque
              </p>
              <div className="flex flex-wrap gap-2">
                {quickAccess.map(({ icon: Icon, label }) => (
                  <Link key={label} className="brujula-quick-link" to="/login">
                    <span className="brujula-quick-icon">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="brujula-trust mt-5 flex flex-wrap gap-x-7 gap-y-3 border-t pt-5 text-sm">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Datos protegidos por diseño
              </span>
              <span className="inline-flex items-center gap-2">
                <Monitor className="h-4 w-4" aria-hidden="true" />
                Cada grupo en su propio espacio
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="relative h-[260px] w-[260px] max-w-full sm:h-[330px] sm:w-[330px] lg:h-[380px] lg:w-[380px]">
              <span className="brujula-emblem-glow absolute -inset-10 rounded-full" aria-hidden="true" />
              <span className="brujula-coordinate absolute -left-5 top-2">34°36′ S</span>
              <CompassSeal className="relative z-10 drop-shadow-2xl" />
              <span className="brujula-coordinate absolute -bottom-1 -right-6">58°22′ O</span>
            </div>
          </div>
        </div>
      </section>

      <section id="fondo" className="brujula-public-summary px-5 py-16 sm:px-10" aria-labelledby="public-summary-title">
        <div className="mx-auto max-w-7xl">
          <p className="brujula-summary-eyebrow">Vista rápida</p>
          <h2 id="public-summary-title" className="mt-3 max-w-2xl text-3xl font-extrabold sm:text-4xl">
            Una base sólida para organizar el grupo.
          </h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {platformHighlights.map(({ icon: Icon, title, description }) => (
              <article key={title} className="brujula-summary-card p-6">
                <span className="brujula-summary-icon">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3>
                <p className="brujula-summary-copy mt-2 text-sm leading-6">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
