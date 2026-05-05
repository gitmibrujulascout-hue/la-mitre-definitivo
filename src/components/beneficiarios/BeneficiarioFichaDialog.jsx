import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import RamaBadge from '@/components/shared/RamaBadge';
import { Phone, Mail, MapPin, User, Shield, BookOpen, Calendar, Award, UserCog } from 'lucide-react';

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 pl-6">
        {children}
      </div>
    </div>
  );
}

export default function BeneficiarioFichaDialog({ open, onClose, beneficiario: b }) {
  if (!b) return null;

  const edad = b.fecha_nacimiento
    ? Math.floor((new Date() - new Date(b.fecha_nacimiento)) / (365.25 * 24 * 3600 * 1000))
    : null;

  const formatFecha = (f) => {
    if (!f) return null;
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  };

  const direccion = [b.calle, b.localidad, b.provincia, b.codigo_postal].filter(Boolean).join(', ');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{b.nombre}</DialogTitle>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <RamaBadge rama={b.rama} />
            {b.tipo === 'Voluntario' && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-300 border"><UserCog className="w-3 h-3 mr-1" />Voluntario</Badge>
            )}
            {b.becado && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-300 border"><Award className="w-3 h-3 mr-1" />Becado</Badge>
            )}
            {!b.activo && (
              <Badge variant="secondary">Inactivo</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Básico */}
          <Section icon={User} title="Datos básicos">
            <Field label="DNI" value={b.dni} />
            <Field label="Fecha de nacimiento" value={edad !== null ? `${formatFecha(b.fecha_nacimiento)} (${edad} años)` : formatFecha(b.fecha_nacimiento)} />
            <Field label="Teléfono" value={b.telefono_contacto} />
            <Field label="Email" value={b.email_contacto} />
            <Field label="Grupo familiar" value={b.grupo_familiar} />
            <Field label="Primera afiliación" value={formatFecha(b.fecha_primer_afiliacion)} />
          </Section>

          <Separator />

          {/* Scout */}
          <Section icon={BookOpen} title="Datos scout">
            <Field label="Función" value={b.funcion} />
            <Field label="Categoría" value={b.categoria} />
            <Field label="Rama a cargo" value={b.rama_educador} />
            <Field label="Zona" value={b.zona} />
            <Field label="Distrito" value={b.distrito} />
            <Field label="Código" value={b.codigo} />
            <Field label="Organismo" value={b.organismo} />
            <Field label="Religión" value={b.religion} />
            {b.religion_descripcion && <Field label="Descripción religión" value={b.religion_descripcion} />}
          </Section>

          <Separator />

          {/* Personal */}
          <Section icon={Shield} title="Datos personales">
            <Field label="Sexo" value={b.sexo} />
            <Field label="Estado civil" value={b.estado_civil} />
            <Field label="Nacionalidad" value={b.nacionalidad} />
            <Field label="Estudios" value={b.estudios} />
            <Field label="Título" value={b.titulo} />
            <Field label="Discapacidad" value={b.discapacidad} />
            {b.detalle_discapacidad && <Field label="Detalle discapacidad" value={b.detalle_discapacidad} />}
          </Section>

          {direccion && (
            <>
              <Separator />
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Dirección</p>
                  <p className="text-sm font-medium">{direccion}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}