import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search, Phone, MessageCircle, AlertTriangle, Heart,
  User, MapPin, ShieldCheck, Activity, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { differenceInYears } from 'date-fns';

const RAMAS = ['Todas', 'Lobatos', 'Tropa', 'KM', 'Rovers', 'Voluntario', 'Educador'];

const RAMA_COLORS = {
  Lobatos: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  Tropa: 'bg-green-100 text-green-800 border-green-300',
  KM: 'bg-blue-100 text-blue-800 border-blue-300',
  Rovers: 'bg-red-100 text-red-800 border-red-300',
  Voluntario: 'bg-purple-100 text-purple-800 border-purple-300',
  Educador: 'bg-slate-100 text-slate-800 border-slate-300',
};

function formatPhone(raw) {
  if (!raw) return null;
  return raw.replace(/\D/g, '');
}

function whatsappUrl(raw) {
  const num = formatPhone(raw);
  if (!num) return null;
  const full = num.startsWith('54') ? num : `54${num}`;
  return `https://web.whatsapp.com/send?phone=${full}`;
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

// ——— Tarjeta compacta de beneficiario ———
function BeneficiarioCard({ b, onClick }) {
  const edad = calcEdad(b.fecha_nacimiento);
  const tieneAlerta = b.alergias || b.condicion_medica || b.medicacion_habitual;
  const tel1 = b.telefono_contacto;
  const tel2 = b.telefono_contacto_2;

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all duration-200 group"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold',
              b.rama ? RAMA_COLORS[b.rama]?.replace('border-', '').split(' ').slice(0,2).join(' ') : 'bg-slate-100 text-slate-600'
            )}>
              {b.nombre?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{b.nombre}</p>
                {tieneAlerta && (
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" title="Tiene condición médica o alergia" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {b.rama && (
                  <Badge variant="outline" className={cn('text-xs border', RAMA_COLORS[b.rama])}>
                    {b.rama}
                  </Badge>
                )}
                {edad !== null && (
                  <span className="text-xs text-muted-foreground">{edad} años</span>
                )}
                {b.dni && (
                  <span className="text-xs text-muted-foreground">DNI {b.dni}</span>
                )}
              </div>
              {/* Alergias en preview */}
              {b.alergias && (
                <p className="text-xs text-amber-700 mt-1 truncate">⚠ {b.alergias}</p>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1" />
        </div>

        {/* Botones de contacto */}
        {(tel1 || tel2) && (
          <div className="mt-3 flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
            {[tel1, tel2].filter(Boolean).map((tel, i) => (
              <div key={i} className="flex gap-1">
                <a
                  href={whatsappUrl(tel)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 border border-green-200 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                  title={`WhatsApp: ${tel}`}
                >
                  <MessageCircle className="w-3 h-3" />
                  {i === 0 ? 'WA' : 'WA 2'}
                </a>
                <a
                  href={callUrl(tel)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                  title={`Llamar: ${tel}`}
                >
                  <Phone className="w-3 h-3" />
                  {tel}
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ——— Modal detalle completo ———
function BeneficiarioDetalleModal({ b, onClose }) {
  if (!b) return null;
  const edad = calcEdad(b.fecha_nacimiento);
  const tel1 = b.telefono_contacto;
  const tel2 = b.telefono_contacto_2;

  const Section = ({ icon: Icon, title, children, highlight }) => (
    <div className={cn('rounded-lg border p-4', highlight && 'border-amber-300 bg-amber-50')}>
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

  const hasHealthData = b.alergias || b.condicion_medica || b.medicacion_habitual ||
    b.obra_social || b.numero_obra_social || b.discapacidad || b.detalle_discapacidad || b.observaciones_salud;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0',
              b.rama ? RAMA_COLORS[b.rama]?.replace('border-', '').split(' ').slice(0,2).join(' ') : 'bg-slate-100'
            )}>
              {b.nombre?.[0] || '?'}
            </div>
            <div>
              <p>{b.nombre}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {b.rama && (
                  <Badge variant="outline" className={cn('text-xs border', RAMA_COLORS[b.rama])}>
                    {b.rama}
                  </Badge>
                )}
                {edad !== null && <span className="text-xs text-muted-foreground font-normal">{edad} años</span>}
                {b.activo === false && <Badge variant="destructive" className="text-xs">Inactivo</Badge>}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">

          {/* Alerta médica destacada */}
          {(b.alergias || b.condicion_medica || b.medicacion_habitual) && (
            <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
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

          {/* Contactos de emergencia */}
          <Section icon={Phone} title="Contacto rápido">
            <div className="space-y-3">
              {[
                { label: 'Teléfono principal', tel: tel1 },
                { label: 'Teléfono secundario', tel: tel2 },
              ].filter(c => c.tel).map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-sm font-medium">{c.tel}</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={whatsappUrl(c.tel)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 border border-green-300 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                    <a
                      href={callUrl(c.tel)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 border border-blue-300 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" /> Llamar
                    </a>
                  </div>
                </div>
              ))}

              {/* Contacto emergencia designado */}
              {b.contacto_emergencia_nombre && (
                <div className="mt-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Contacto de emergencia designado</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.contacto_emergencia_nombre}</p>
                      <p className="text-xs text-muted-foreground">{b.contacto_emergencia_relacion} · {b.contacto_emergencia_telefono}</p>
                    </div>
                    {b.contacto_emergencia_telefono && (
                      <div className="flex gap-2">
                        <a
                          href={whatsappUrl(b.contacto_emergencia_telefono)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 border border-green-300 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WA
                        </a>
                        <a
                          href={callUrl(b.contacto_emergencia_telefono)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 border border-blue-300 text-blue-700 text-xs font-medium hover:bg-blue-200 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" /> Llamar
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!tel1 && !tel2 && !b.contacto_emergencia_telefono && (
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
              {b.rama_educador && <Field label="Rama educador" value={b.rama_educador} />}
              <Field label="Organismo" value={b.organismo} />
              <Field label="Código" value={b.codigo} />
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
          {hasHealthData && (
            <Section icon={Activity} title="Salud y cobertura" highlight={!!(b.alergias || b.condicion_medica)}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {b.alergias && <Field label="Alergias" value={b.alergias} className="text-amber-800" />}
                {b.condicion_medica && <Field label="Condición médica" value={b.condicion_medica} className="text-amber-800" />}
                {b.medicacion_habitual && <Field label="Medicación habitual" value={b.medicacion_habitual} className="text-amber-800" />}
                <Field label="Obra social / Prepaga" value={b.obra_social} />
                <Field label="Nº afiliado" value={b.numero_obra_social} />
                {b.discapacidad && <Field label="Discapacidad" value={b.discapacidad} />}
                {b.detalle_discapacidad && <Field label="Detalle discapacidad" value={b.detalle_discapacidad} />}
              </div>
              {b.observaciones_salud && (
                <div className="mt-2 pt-2 border-t">
                  <Field label="Observaciones de salud" value={b.observaciones_salud} />
                </div>
              )}
            </Section>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ——— Página principal ———
export default function DirectorioEmergencias() {
  const [busqueda, setBusqueda] = useState('');
  const [ramaFiltro, setRamaFiltro] = useState('Todas');
  const [seleccionado, setSeleccionado] = useState(null);

  const { data: beneficiarios = [], isLoading } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const filtrados = useMemo(() => {
    return beneficiarios
      .filter(b => b.activo !== false)
      .filter(b => {
        if (ramaFiltro !== 'Todas' && b.rama !== ramaFiltro) return false;
        if (busqueda) {
          const q = busqueda.toLowerCase();
          return b.nombre?.toLowerCase().includes(q) || b.dni?.includes(q);
        }
        return true;
      })
      .sort((a, b) => a.nombre?.localeCompare(b.nombre));
  }, [beneficiarios, busqueda, ramaFiltro]);

  const conAlerta = filtrados.filter(b => b.alergias || b.condicion_medica || b.medicacion_habitual);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <Heart className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Directorio de Emergencias</h1>
            <p className="text-sm text-muted-foreground">Consulta de contactos y datos médicos del grupo</p>
          </div>
        </div>
      </div>

      {/* Alerta resumen */}
      {conAlerta.length > 0 && (
        <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>{conAlerta.length}</strong> miembro{conAlerta.length !== 1 ? 's' : ''} tiene{conAlerta.length !== 1 ? 'n' : ''} alergias o condiciones médicas registradas.
            Aparecen marcados con <strong>⚠</strong>.
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o DNI..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ramaFiltro} onValueChange={setRamaFiltro}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RAMAS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <Users2 className="w-4 h-4" />
          {filtrados.length} miembro{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Grilla */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No se encontraron miembros</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(b => (
            <BeneficiarioCard key={b.id} b={b} onClick={() => setSeleccionado(b)} />
          ))}
        </div>
      )}

      {/* Modal detalle */}
      {seleccionado && (
        <BeneficiarioDetalleModal b={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </div>
  );
}

// Necesario importar Users2 de lucide
function Users2(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 19a6 6 0 0 0-12 0"/><circle cx="8" cy="9" r="4"/><path d="M22 19a6 6 0 0 0-6-6 4 4 0 1 0 0-8"/></svg>;
}