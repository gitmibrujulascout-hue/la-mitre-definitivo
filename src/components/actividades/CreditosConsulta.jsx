import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, ChevronRight, ChevronDown, CreditCard, Tent, ShoppingCart } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

const USAGE_ICON = { 'Cuota': CreditCard, 'Campamento': Tent, 'Tienda': ShoppingCart };
const USAGE_COLOR = { 'Cuota': 'text-blue-600', 'Campamento': 'text-purple-600', 'Tienda': 'text-green-600' };

export default function CreditosConsulta({ beneficiarios }) {
  const [actividadSel, setActividadSel] = useState('todas');
  const [expanded, setExpanded] = useState({});

  const { data: creditos = [], isLoading } = useQuery({
    queryKey: ['creditos-todos'],
    queryFn: () => base44.entities.CreditoBeneficiario.list('-fecha', 500),
  });

  const { data: pagosCredito = [] } = useQuery({
    queryKey: ['pagos-credito'],
    queryFn: () => base44.entities.Pago.filter({ forma_pago: 'Crédito actividad' }, '-fecha_pago', 500),
  });

  const { data: ventasTiendaCredito = [] } = useQuery({
    queryKey: ['ventas-tienda-credito'],
    queryFn: () => base44.entities.VentaTienda.filter({ forma_pago: 'Crédito actividad' }, '-fecha', 500),
  });

  const actividadesMap = useMemo(() => {
    const mapa = {};
    creditos.forEach(c => {
      const key = c.actividad_id || 'sin-id';
      if (!mapa[key]) mapa[key] = { id: key, nombre: c.actividad_nombre || 'Sin actividad', creditos: [] };
      mapa[key].creditos.push(c);
    });
    return Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [creditos]);

  const creditosFiltrados = useMemo(() => {
    if (actividadSel === 'todas') return creditos;
    return creditos.filter(c => c.actividad_id === actividadSel);
  }, [creditos, actividadSel]);

  const totalOriginal = creditosFiltrados.reduce((s, c) => s + (c.monto_original || 0), 0);
  const totalDisponible = creditosFiltrados.reduce((s, c) => s + (c.monto_disponible || 0), 0);
  const totalUsado = totalOriginal - totalDisponible;

  const getUsos = (credito) => {
    const usos = [];
    const actNombre = credito.actividad_nombre || '';

    pagosCredito
      .filter(p => p.beneficiario_id === credito.beneficiario_id && p.observaciones?.includes(actNombre))
      .forEach(p => {
        usos.push({
          tipo: p.tipo_pago === 'Cuota' ? 'Cuota' : 'Campamento',
          descripcion: p.tipo_pago === 'Cuota'
            ? `Cuota ${p.anio} — ${(p.meses || [p.mes]).filter(Boolean).join(', ')}`
            : `${p.campamento_nombre || 'Campamento'}`,
          monto: p.monto,
          fecha: p.fecha_pago,
        });
      });

    ventasTiendaCredito
      .filter(v => v.beneficiario_id === credito.beneficiario_id && v.observaciones?.includes(actNombre))
      .forEach(v => {
        usos.push({
          tipo: 'Tienda',
          descripcion: `${v.producto_nombre}${v.cantidad > 1 ? ` (x${v.cantidad})` : ''}`,
          monto: v.monto_total,
          fecha: v.fecha,
        });
      });

    return usos.sort((a, b) => new Date(b.fecha || '') - new Date(a.fecha || ''));
  };

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const creditosOrdenados = useMemo(() => {
    return [...creditosFiltrados].sort((a, b) => {
      const na = a.beneficiario_nombre || '';
      const nb = b.beneficiario_nombre || '';
      return na.localeCompare(nb);
    });
  }, [creditosFiltrados]);

  return (
    <div>
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-primary" />
            <Select value={actividadSel} onValueChange={setActividadSel}>
              <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las actividades</SelectItem>
                {actividadesMap.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Acreditado</p>
              <p className="font-bold text-blue-600">{formatMoney(totalOriginal)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Usado</p>
              <p className="font-bold text-orange-600">{formatMoney(totalUsado)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Disponible</p>
              <p className="font-bold text-green-600">{formatMoney(totalDisponible)}</p>
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">Cargando...</p>
      ) : creditosOrdenados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay créditos registrados</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Beneficiario</TableHead>
                {actividadSel === 'todas' && <TableHead>Actividad</TableHead>}
                <TableHead className="text-right">Acreditado</TableHead>
                <TableHead className="text-right">Usado</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditosOrdenados.map(c => {
                const usado = (c.monto_original || 0) - (c.monto_disponible || 0);
                const isExpanded = expanded[c.id];
                const usos = isExpanded ? getUsos(c) : [];
                return (
                  <React.Fragment key={c.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(c.id)}
                    >
                      <TableCell>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </TableCell>
                      <TableCell className="font-medium">{c.beneficiario_nombre}</TableCell>
                      {actividadSel === 'todas' && <TableCell className="text-sm text-muted-foreground">{c.actividad_nombre}</TableCell>}
                      <TableCell className="text-right">{formatMoney(c.monto_original || 0)}</TableCell>
                      <TableCell className="text-right text-orange-600">{formatMoney(usado)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{formatMoney(c.monto_disponible || 0)}</TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={actividadSel === 'todas' ? 6 : 5} className="bg-muted/30">
                          {usos.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">Sin uso registrado</p>
                          ) : (
                            <div className="space-y-1 py-2">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Detalle de uso del crédito:</p>
                              {usos.map((u, i) => {
                                const UIcon = USAGE_ICON[u.tipo] || CreditCard;
                                return (
                                  <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-border last:border-0">
                                    <UIcon className={cn('w-4 h-4 flex-shrink-0', USAGE_COLOR[u.tipo])} />
                                    <div className="flex-1">
                                      <span className="font-medium">{u.descripcion}</span>
                                      <span className="text-xs text-muted-foreground ml-2">{u.fecha}</span>
                                    </div>
                                    <span className="font-medium text-orange-600">−{formatMoney(u.monto)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}