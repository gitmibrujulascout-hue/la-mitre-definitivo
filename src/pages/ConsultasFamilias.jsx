import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import { Eye, EyeOff, Search, CheckCircle2, XCircle, Users } from 'lucide-react';
import { esBeneficiarioConCuota, compararPorRamaYApellido } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

function fechaLinda(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ConsultasFamilias() {
  const { data: consultas = [], isLoading } = useQuery({
    queryKey: ['consultas_dni'],
    queryFn: () => base44.entities.ConsultaDni.list('-created_date', 500),
  });
  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  // Familias esperadas: beneficiarios activos con cuota, agrupados por grupo familiar
  const familias = useMemo(() => {
    const map = {};
    beneficiarios
      .filter(b => b.activo !== false && esBeneficiarioConCuota(b))
      .forEach(b => {
        const key = b.grupo_familiar || `__ind_${b.id}`;
        if (!map[key]) map[key] = { key, grupo: b.grupo_familiar, miembros: [] };
        map[key].miembros.push(b);
      });
    return Object.values(map).map(f => ({
      ...f,
      miembros: f.miembros.sort((a, b) =>
        compararPorRamaYApellido(a.rama, a.nombre, b.rama, b.nombre)
      ),
      label: f.grupo ? `Familia ${f.grupo}` : (f.miembros[0]?.nombre || '—'),
    }));
  }, [beneficiarios]);

  // Consultas agrupadas por beneficiario encontrado
  const consultasPorBen = useMemo(() => {
    const map = {};
    consultas.forEach(c => {
      if (c.encontrado && c.beneficiario_id) {
        (map[c.beneficiario_id] = map[c.beneficiario_id] || []).push(c);
      }
    });
    return map;
  }, [consultas]);

  const idsConConsulta = useMemo(() => new Set(Object.keys(consultasPorBen)), [consultasPorBen]);

  const familiasConConsulta = useMemo(
    () => familias.filter(f => f.miembros.some(m => idsConConsulta.has(m.id))),
    [familias, idsConConsulta]
  );
  const familiasSinConsulta = useMemo(
    () => familias.filter(f => !f.miembros.some(m => idsConConsulta.has(m.id))),
    [familias, idsConConsulta]
  );

  const stats = {
    totalConsultas: consultas.length,
    consultasFallidas: consultas.filter(c => !c.encontrado).length,
    consultaron: familiasConConsulta.length,
    sinConsultar: familiasSinConsulta.length,
    totalFamilias: familias.length,
  };

  const ultimaDeFamilia = (f) => {
    let last = null;
    f.miembros.forEach(m => {
      const list = consultasPorBen[m.id];
      if (list && list[0]) {
        if (!last || new Date(list[0].created_date) > new Date(last.created_date)) last = list[0];
      }
    });
    return last;
  };

  const totalConsultasDeFamilia = (f) =>
    f.miembros.reduce((s, m) => s + (consultasPorBen[m.id]?.length || 0), 0);

  const recientes = consultas.slice(0, 25);

  return (
    <div>
      <PageHeader
        title="Consultas de Familias"
        description="Seguimiento de qué familias usan la consulta de Estado de Cuenta por DNI"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search className="w-4 h-4" />
            <span className="text-xs">Consultas totales</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.totalConsultas}</p>
          {stats.consultasFallidas > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">{stats.consultasFallidas} con DNI no encontrado</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Eye className="w-4 h-4" />
            <span className="text-xs">Familias que consultaron</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-green-600">
            {stats.consultaron}<span className="text-base text-muted-foreground"> / {stats.totalFamilias}</span>
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <EyeOff className="w-4 h-4" />
            <span className="text-xs">Familias sin consultar</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-red-500">{stats.sinConsultar}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-xs">Adopción</span>
          </div>
          <p className="text-2xl font-bold mt-1">
            {stats.totalFamilias > 0 ? Math.round(stats.consultaron / stats.totalFamilias * 100) : 0}%
          </p>
        </Card>
      </div>

      {/* Familias que NO consultaron — insistir */}
      {familiasSinConsulta.length > 0 && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50/40">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3 text-red-800">
            <EyeOff className="w-4 h-4" />
            Familias que todavía no consultaron ({familiasSinConsulta.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {familiasSinConsulta.map(f => (
              <div key={f.key} className="rounded-lg border border-red-200 bg-white p-2.5">
                <p className="font-medium text-sm">{f.label}</p>
                <p className="text-xs text-muted-foreground">
                  {f.miembros.map(m => m.nombre).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Familias que consultaron */}
      <Card className="p-4 mb-6">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-green-600" />
          Familias que consultaron ({familiasConConsulta.length})
        </h3>
        {familiasConConsulta.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay consultas registradas.</p>
        ) : (
          <div className="space-y-2">
            {familiasConConsulta.map(f => {
              const ult = ultimaDeFamilia(f);
              const total = totalConsultasDeFamilia(f);
              return (
                <div key={f.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border bg-green-50/30 p-3">
                  <div>
                    <p className="font-medium text-sm">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.miembros.map(m => m.nombre).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant="secondary">{total} {total === 1 ? 'consulta' : 'consultas'}</Badge>
                    <span className="text-muted-foreground">Última: <strong className="text-foreground">{fechaLinda(ult?.created_date)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Registro reciente */}
      <Card className="p-4">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <Search className="w-4 h-4" />
          Registro de consultas (recientes)
        </h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : recientes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin registros.</p>
        ) : (
          <div className="divide-y">
            {recientes.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2 text-sm">
                {c.encontrado ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span className="font-mono w-28">{c.dni_buscado}</span>
                <span className="flex-1 truncate">
                  {c.encontrado ? (c.beneficiario_nombre || 'Encontrado') : <span className="text-muted-foreground italic">DNI no encontrado</span>}
                </span>
                <span className="text-xs text-muted-foreground">{fechaLinda(c.created_date)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}