import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

export default function ResumenUnidades({ actividad, ventas }) {
  const { data: productos = [] } = useQuery({
    queryKey: ['productos-actividad', actividad.id],
    queryFn: () => base44.entities.ProductoActividad.filter({ actividad_id: actividad.id }),
  });

  if (ventas.length === 0) return null;

  // Map producto_id → grupo
  const grupoMap = {};
  productos.forEach(p => {
    grupoMap[p.id] = p.grupo || p.nombre;
  });

  // Group ventas by grupo (or producto_nombre fallback)
  const porGrupo = {};
  ventas.forEach(v => {
    const grupo = grupoMap[v.producto_id] || v.producto_nombre || actividad.tipo_producto || 'Producto';
    if (!porGrupo[grupo]) porGrupo[grupo] = { unidades: 0, detalles: [] };
    const unidades = v.es_promo ? (v.cantidad_vendida || 0) * (v.cantidad_promo || 1) : (v.cantidad_vendida || 0);
    porGrupo[grupo].unidades += unidades;
    porGrupo[grupo].detalles.push({
      nombre: v.producto_nombre || actividad.tipo_producto || 'Producto',
      unidades,
      cantidad_vendida: v.cantidad_vendida || 0,
      es_promo: v.es_promo,
      cantidad_promo: v.cantidad_promo,
    });
  });

  const grupos = Object.entries(porGrupo).sort((a, b) => a[0].localeCompare(b[0], 'es'));
  const totalUnidades = grupos.reduce((s, [, g]) => s + g.unidades, 0);

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Resumen de unidades a preparar
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {grupos.map(([grupo, data]) => (
            <div key={grupo} className="rounded-lg bg-white/70 border border-primary/15 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-sm text-foreground">{grupo}</p>
                <p className="text-2xl font-bold text-primary">{data.unidades}</p>
              </div>
              <p className="text-xs text-muted-foreground mb-1.5">unidad{data.unidades !== 1 ? 'es' : ''} en total</p>
              {/* Detalle de qué compone el total */}
              <div className="space-y-0.5">
                {/* Merge same product+promo combo within this group */}
                {(() => {
                  const merged = {};
                  data.detalles.forEach(d => {
                    const key = d.es_promo
                      ? `${d.nombre} (promo x${d.cantidad_promo})`
                      : d.nombre;
                    if (!merged[key]) merged[key] = { ...d, count: 0, unidades: 0 };
                    merged[key].count += d.cantidad_vendida;
                    merged[key].unidades += d.unidades;
                  });
                  return Object.values(merged).map(d => (
                    <div key={`${d.nombre}-${d.es_promo}-${d.cantidad_promo}`} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {d.es_promo
                          ? `${d.count} promo${d.count !== 1 ? 's' : ''} de ${d.cantidad_promo}`
                          : `${d.count} individual${d.count !== 1 ? 'es' : ''}`}
                      </span>
                      <span className="font-medium text-foreground/80">{d.unidades} uds</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-primary/15 flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground">Total general de unidades</p>
          <p className="text-3xl font-bold text-primary">{totalUnidades}</p>
        </div>
      </CardContent>
    </Card>
  );
}