import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search, Phone, MessageCircle, AlertTriangle, Heart,
  User, MapPin, ShieldCheck, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInYears } from 'date-fns';

const RAMA_COLORS = {
  Lobatos: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Tropa: 'bg-green-100 text-green-800 border-green-300',
  KM: 'bg-blue-100 text-blue-800 border-blue-300',
  Rovers: 'bg-red-100 text-red-800 border-red-300',
  Voluntario: 'bg-purple-100 text-purple-800 border-purple-300',
  Educador: 'bg-slate-100 text-slate-800 border-slate-300',
};

function normalize(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatPhone(raw) {
  if (!raw) return null;
  return raw.replace(/\D/g, '');
}

function whatsappUrl(raw) {
  const num = formatPhone(raw);
  if (!num) return null;
  const full = num.startsWith('54') ? num : `54${num}`;
  return `https://api.whatsapp.com/send?phone=${full}`;
}

function callUrl(raw) {
  const num = formatPhone(raw);
  if (!num) return null;
  return `tel:${num}`;
}

function calcEdad(fecha) {
  if (!fecha) return null;
  return differenceInYears(new Date(), new Date(fecha));
}

const Section = ({ icon: Icon, title, children, highlight }) => (
  <div className={cn('rounded-xl border p-4', highlight ? 'border-amber-300 bg-amber-50' : 'border bg-white')}>
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('w-4 h-4', highlight ? 'text-amber-600' : 'text-primary')} />
      <h3 className={cn('font-semibold text-sm', highlight ? 'text-amber-800' : '')}>{title}</h3>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

const Field = ({ label, value, className }) => {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-sm font-medium', className)}>{value}</p>
    </div>
  );
};

const ContactBtn = ({ href, icon: Icon, label, colorClass }) => (
  <a
    href={href}
    target={href?.startsWith('http') ? '_blank' : undefined}
    rel="noopener noreferrer"
    className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors', colorClass)}
  >
    <Icon className="w-3.5 h-3.5" /> {label}
  </a>
);

export default function FichaEmergencia() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [beneficiario, setBeneficiario] = useState(null);
  const [resultados, setResultados] = useState([]);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const buscar = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setNoEncontrado(false);
    setBeneficiario(null);
    setResultados([]);

    const esDni = /^\d+$/.test(query.trim());
    let encontrados = [];

    if (esDni) {
      encontrados = await base44.entities.Beneficiario.filter({ dni: query.trim() }, '-created_date', 10);
    } else {
      const q = normalize(query.trim());
      const todos = await base44.entities.Beneficiario.filter({ activo: true }, 'nombre', 1000);
      encontrados = todos.filter(b => normalize(b.nombre).includes(q));
    }

    const activos = encontrados.filter(b => b.activo !== false);

    if (activos.length === 1) {
      setBeneficiario(activos[0]);
    } else if (activos.length > 1) {
      setResultados(activos);
    } else {
      setNoEncontrado(true);
    }
    setLoading(false);
  };

  const b = beneficiario;
  const edad = b ? calcEdad(b.fecha_nacimiento) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mb-3">
          <Heart className="w-7 h-7 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold">Ficha de Emergencias</h1>
        <p className="text-sm text-muted-foreground mt-1">Ingresá tu nombre o DNI para ver tus datos de contacto y salud</p>
      </div>

      {/* Buscador */}
      <div className="w-full max-w-sm mb-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Nombre o número de DNI..."
              value={query}
              onChange={e => { setQuery(e.target.value); setBeneficiario(null); setResultados([]); setNoEncontrado(false); }}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              className="pl-9"
            />
          </div>
          <Button onClick={buscar} disabled={loading || !query.trim()}>
            {loading ? 'Buscando...' : 'Consultar'}
          </Button>
        </div>

        {noEncontrado && (
          <p className="text-sm text-destructive mt-3 text-center">
            No se encontró ningún miembro activo con ese nombre o DNI.
          </p>
        )}

        {/* Lista de resultados múltiples */}
        {resultados.length > 1 && (
          <div className="mt-3 rounded-xl border bg-white shadow-sm overflow-hidden">
            <p className="text-xs text-muted-foreground px-4 py-2 border-b">Se encontraron varios miembros. Seleccioná uno:</p>
            {resultados.map(r => (
              <button
                key={r.id}
                onClick={() => { setBeneficiario(r); setResultados([]); }}
                className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-b-0 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm flex-shrink-0">
                  {r.nombre?.[0] || '?'}
                </div>
                <div>
                  <p className="text-sm font-medium">{r.nombre}</p>
                  <p className="text-xs text-muted-foreground">{[r.rama, r.dni ? `DNI ${r.dni}` : null].filter(Boolean).join(' · ')}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ficha */}
      {b && (
        <div className="w-full max-w-xl space-y-4">

          {/* Encabezado del miembro */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-white border">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0',
              b.rama ? RAMA_COLORS[b.rama]?.split(' ').slice(0, 2).join(' ') : 'bg-slate-100 text-slate-600'
            )}>
              {b.nombre?.[0] || '?'}
            </div>
            <div>
              <p className="text-lg font-bold">{b.nombre}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {b.rama && (
                  <Badge variant="outline" className={cn('text-xs border', RAMA_COLORS[b.rama])}>
                    {b.rama}
                  </Badge>
                )}
                {edad !== null && <span className="text-xs text-muted-foreground">{edad} años</span>}
                {b.dni && <span className="text-xs text-muted-foreground">DNI {b.dni}</span>}
              </div>
            </div>
          </div>

          {/* ALERTA MÉDICA */}
          {(b.alergias || b.condicion_medica || b.medicacion_habitual) && (
            <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-amber-800">⚠ ATENCIÓN MÉDICA</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {b.alergias && (
                  <div>
                    <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Alergias</p>
                    <p className="text-sm font-medium text-amber-900">{b.alergias}</p>
                  </div>
                )}
                {b.condicion_medica && (
                  <div>
                    <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Condición médica</p>
                    <p className="text-sm font-medium text-amber-900">{b.condicion_medica}</p>
                  </div>
                )}
                {b.medicacion_habitual && (
                  <div>
                    <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Medicación habitual</p>
                    <p className="text-sm font-medium text-amber-900">{b.medicacion_habitual}</p>
                  </div>
                )}
              </div>
              {b.observaciones_salud && (
                <div className="mt-3 pt-3 border-t border-amber-300">
                  <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Observaciones</p>
                  <p className="text-sm text-amber-900">{b.observaciones_salud}</p>
                </div>
              )}
            </div>
          )}

          {/* Contacto rápido */}
          <Section icon={Phone} title="Contacto rápido">
            <div className="space-y-3">
              {[
                { label: 'Teléfono principal', tel: b.telefono_contacto },
                { label: 'Teléfono secundario', tel: b.telefono_contacto_2 },
              ].filter(c => c.tel).map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-sm font-medium">{c.tel}</p>
                  </div>
                  <div className="flex gap-2">
                    <ContactBtn href={whatsappUrl(c.tel)} icon={MessageCircle} label="WhatsApp" colorClass="bg-green-100 border-green-300 text-green-700 hover:bg-green-200" />
                    <ContactBtn href={callUrl(c.tel)} icon={Phone} label="Llamar" colorClass="bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200" />
                  </div>
                </div>
              ))}

              {b.contacto_emergencia_nombre && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Contacto de emergencia designado</p>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">{b.contacto_emergencia_nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {[b.contacto_emergencia_relacion, b.contacto_emergencia_telefono].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {b.contacto_emergencia_telefono && (
                      <div className="flex gap-2">
                        <ContactBtn href={whatsappUrl(b.contacto_emergencia_telefono)} icon={MessageCircle} label="WA" colorClass="bg-green-100 border-green-300 text-green-700 hover:bg-green-200" />
                        <ContactBtn href={callUrl(b.contacto_emergencia_telefono)} icon={Phone} label="Llamar" colorClass="bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!b.telefono_contacto && !b.telefono_contacto_2 && !b.contacto_emergencia_nombre && (
                <p className="text-xs text-muted-foreground italic">Sin teléfonos registrados</p>
              )}
            </div>
          </Section>

          {/* Datos personales */}
          <Section icon={User} title="Datos personales">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="DNI" value={b.dni} />
              <Field label="Edad" value={edad !== null ? `${edad} años` : undefined} />
              <Field label="Fecha de nacimiento" value={b.fecha_nacimiento} />
              <Field label="Sexo" value={b.sexo} />
              <Field label="Nacionalidad" value={b.nacionalidad} />
              <Field label="Email" value={b.email_contacto} />
            </div>
          </Section>

          {/* Scout */}
          <Section icon={ShieldCheck} title="Datos scouts">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Rama" value={b.rama} />
              <Field label="Función" value={b.funcion} />
              <Field label="Tipo" value={b.tipo} />
              <Field label="Organismo" value={b.organismo} />
              <Field label="Zona" value={b.zona} />
              <Field label="Distrito" value={b.distrito} />
            </div>
          </Section>

          {/* Domicilio */}
          {(b.calle || b.localidad || b.provincia) && (
            <Section icon={MapPin} title="Domicilio">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Dirección" value={b.calle} />
                <Field label="Localidad" value={b.localidad} />
                <Field label="Provincia" value={b.provincia} />
                <Field label="Código postal" value={b.codigo_postal} />
              </div>
            </Section>
          )}

          {/* Salud */}
          {(b.obra_social || b.numero_obra_social || b.discapacidad) && (
            <Section icon={Activity} title="Cobertura médica">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Obra social / Prepaga" value={b.obra_social} />
                <Field label="Nº afiliado" value={b.numero_obra_social} />
                {b.discapacidad && <Field label="Discapacidad" value={b.discapacidad} />}
                {b.detalle_discapacidad && <Field label="Detalle" value={b.detalle_discapacidad} />}
              </div>
            </Section>
          )}

        </div>
      )}
    </div>
  );
}