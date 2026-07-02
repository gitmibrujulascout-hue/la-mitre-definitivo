import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil, Plus, Trash2, TrendingUp, DollarSign, Gift, CheckCircle2, PackageCheck, Package, FileText, Banknote, MessageCircle } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import VentaForm from '@/components/actividades/VentaForm';
import GastoActividadForm from '@/components/actividades/GastoActividadForm';
import DistribuirCreditosDialog from '@/components/actividades/DistribuirCreditosDialog';
import ReporteVentasDialog from '@/components/actividades/ReporteVentasDialog.jsx';
import ProductosActividadPanel from '@/components/actividades/ProductosActividadPanel';
import RendicionDialog from '@/components/actividades/RendicionDialog';
import RendicionMasivaDialog from '@/components/actividades/RendicionMasivaDialog';
import GananciasGrupoDialog from '@/components/actividades/GananciasGrupoDialog';
import ResumenUnidades from '@/components/actividades/ResumenUnidades';

const ESTADO_COLORS = {
  Planificada: 'bg-blue-100 text-blue-700 border-blue-200 border',
  'En curso': 'bg-amber-100 text-amber-700 border-amber-200 border',
  Finalizada: 'bg-green-100 text-green-700 border-green-200 border',
};

export default function ActividadDetalle({ actividad, beneficiarios, onBack, onEdit, onSaved }) {
  const [showVentaForm, setShowVentaForm] = useState(false);
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [showDistribuir, setShowDistribuir] = useState(false);
  const [showReporte, setShowReporte] = useState(false);
  const [ventaRendicion, setVentaRendicion] = useState(null);
  const [showRendicionMasiva, setShowRendicionMasiva] = useState(false);
  const [showGananciasGrupo, setShowGananciasGrupo] = useState(false);
  const queryClient = useQueryClient();

  const { data: ventas = [] } = useQuery({
    queryKey: ['ventas-actividad', actividad.id],
    queryFn: () => base44.entities.VentaActividad.filter({ actividad_id: actividad.id }),
  });

  const { data: gastosAct = [] } = useQuery({
    queryKey: ['gastos-actividad', actividad.id],
    queryFn: () => base44.entities.Gasto.filter({ actividad_id: actividad.id }),
  });

  const { data: creditos = [] } = useQuery({
    queryKey: ['creditos-actividad', actividad.id],
    queryFn: () => base44.entities.CreditoBeneficiario.filter({ actividad_id: actividad.id }),
  });

  const deleteVentaMut = useMutation({
    mutationFn: id => base44.entities.VentaActividad.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ventas-actividad', actividad.id] }),
  });

  const deleteGastoMut = useMutation({
    mutationFn: id => base44.entities.Gasto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gastos-actividad', actividad.id] }),
  });

  const marcarEntregadoMut = useMutation({
    mutationFn: ({ id, entregado, comprador_nombre }) => base44.entities.VentaActividad.update(id, {
      entregado,
      fecha_entrega: entregado ? new Date().toISOString().split('T')[0] : null,
      ...(comprador_nombre ? { comprador_nombre } : {}),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ventas-actividad', actividad.id] }),
  });

  // Gastos generales asociados a esta actividad (mismo query que gastosAct, para referencias)
  const gastosGenerales = gastosAct;

  const totalVentas = ventas.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
  const totalGastos = gastosAct.reduce((s, g) => s + (g.monto || 0), 0);
  const gananciaReal = totalVentas - totalGastos;
  const creditosAcreditados = creditos.length > 0;

  const getBen = (id) => beneficiarios.find(b => b.id === id);

  const buildWhatsAppMsg = (v) => {
    // Agrupar TODOS los pedidos de este beneficiario
    const pedidosBen = ventas.filter(x => x.beneficiario_id === v.beneficiario_id);
    const montoTotal = pedidosBen.reduce((s, x) => s + (x.monto_recaudado || 0), 0);
    const montoRendidoTotal = pedidosBen.reduce((s, x) => s + (x.monto_rendido || (x.estado_rendicion === 'Rendido' ? x.monto_recaudado : 0) || 0), 0);
    const saldoTotal = montoTotal - montoRendidoTotal;
    const todoRendido = pedidosBen.every(x => x.estado_rendicion === 'Rendido');
    const hayParcial = pedidosBen.some(x => x.estado_rendicion === 'Parcial');

    let lineas = [];
    lineas.push(`🔔 *Resumen de pedidos - ${actividad.nombre}*`);
    lineas.push(`👤 Vendedor/a: *${v.beneficiario_nombre}*`);
    lineas.push('');
    lineas.push(`📦 *Detalle de los pedidos (${pedidosBen.length}):*`);
    pedidosBen.forEach((p, i) => {
      const cantDesc = p.es_promo && p.cantidad_promo
        ? `${p.cantidad_vendida} promo(s) de ${p.cantidad_promo} uds`
        : `${p.cantidad_vendida} unidad(es)`;
      lineas.push(`${i + 1}. *${p.producto_nombre || actividad.tipo_producto || 'Producto'}* — ${cantDesc} — $${(p.monto_recaudado || 0).toLocaleString('es-AR')}`);
      if (p.comprador_nombre) {
        lineas.push(`   🛍️ Retira: ${p.comprador_nombre} · ${p.entregado ? `✅ Entregado${p.fecha_entrega ? ` el ${p.fecha_entrega}` : ''}` : '⏳ Pendiente'}`);
      }
    });
    lineas.push('');
    lineas.push(`💰 *Estado del pago:*`);
    lineas.push(`• Total a abonar: *$${montoTotal.toLocaleString('es-AR')}*`);
    if (todoRendido) {
      lineas.push(`✅ Pago recibido completo. ¡Muchas gracias!`);
    } else if (hayParcial || montoRendidoTotal > 0) {
      lineas.push(`⚠️ Recibido hasta ahora: $${montoRendidoTotal.toLocaleString('es-AR')}`);
      lineas.push(`📌 *Saldo pendiente: $${saldoTotal.toLocaleString('es-AR')}*`);
    } else {
      lineas.push(`📌 *Monto a abonar: $${montoTotal.toLocaleString('es-AR')}*`);
    }
    lineas.push(`💸 *Modalidad de pago: Efectivo*`);
    if (actividad.fecha_cierre_pedidos) lineas.push(`📝 Cierre de pedidos: *${actividad.fecha_cierre_pedidos}*`);
    if (actividad.fecha_pago) lineas.push(`💵 Fecha de pago: *${actividad.fecha_pago}*`);
    if (actividad.fecha) lineas.push(`📅 Entrega: *${actividad.fecha}*`);
    lineas.push('');
    lineas.push(`¡Gracias por participar! 🙏`);

    const msg = lineas.join('\n');
    const ben = getBen(v.beneficiario_id);
    const rawPhone = ben?.telefono_contacto || '';
    const digits = rawPhone.replace(/\D/g, '');
    let phone = '';
    if (digits.length >= 8) {
      phone = digits.startsWith('54') ? digits : digits.startsWith('0') ? '54' + digits.slice(1) : '54' + digits;
    }
    const base = phone ? `https://web.whatsapp.com/send?phone=${phone}&text=` : `https://web.whatsapp.com/send?text=`;
    return base + encodeURIComponent(msg);
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['ventas-actividad', actividad.id] });
    queryClient.invalidateQueries({ queryKey: ['creditos-actividad', actividad.id] });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="text-2xl font-bold">{actividad.nombre}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={ESTADO_COLORS[actividad.estado]}>{actividad.estado}</Badge>
              {actividad.tipo_producto && <span className="text-sm text-muted-foreground">{actividad.tipo_producto}</span>}
              <span className="text-sm text-muted-foreground">{actividad.fecha}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {ventas.length > 0 && (
            <>
              <Button onClick={() => setShowRendicionMasiva(true)} variant="outline">
                <Banknote className="w-4 h-4 mr-2" />Rendición masiva
              </Button>
              <Button onClick={() => setShowReporte(true)} variant="outline">
                <FileText className="w-4 h-4 mr-2" />Reporte de ventas
              </Button>
            </>
          )}
          <Button onClick={onEdit} variant="outline"><Pencil className="w-4 h-4 mr-2" />Editar</Button>
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Total recaudado</p>
          <p className="text-xl font-bold text-green-600">{formatMoney(totalVentas)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Gastos producción</p>
          <p className="text-xl font-bold text-red-500">{formatMoney(totalGastos)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Forma de pago</p>
          <p className="text-xl font-bold text-blue-500">Efectivo</p>
        </Card>
        <Card className={`p-3 text-center col-span-2 sm:col-span-1 ${gananciaReal >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-muted-foreground">Ganancia neta</p>
          <p className={`text-xl font-bold ${gananciaReal >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatMoney(gananciaReal)}</p>
        </Card>
      </div>

      {/* Info distribución */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Badge variant="outline">Beneficiario: {actividad.porcentaje_beneficiario || 50}%</Badge>
        <Badge variant="outline">Grupo: {actividad.porcentaje_grupo || 50}%</Badge>
        {actividad.ramas_participantes?.length > 0 && (
          <Badge variant="secondary">{actividad.ramas_participantes.join(', ')}</Badge>
        )}
      </div>

      {/* Acciones de distribución */}
      {ventas.length > 0 && gananciaReal > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {/* Créditos vendedores */}
          {!creditosAcreditados && (
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex flex-col gap-2">
                <div>
                  <p className="font-semibold text-sm">Créditos para vendedores</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {actividad.porcentaje_beneficiario || 50}% de la ganancia → {formatMoney(Math.max(0, gananciaReal) * (actividad.porcentaje_beneficiario || 50) / 100)}
                  </p>
                </div>
                <Button onClick={() => setShowDistribuir(true)} className="w-full">
                  <Gift className="w-4 h-4 mr-2" />Distribuir a vendedores
                </Button>
              </div>
            </Card>
          )}
          {/* Ganancias del grupo */}
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex flex-col gap-2">
              <div>
                <p className="font-semibold text-sm text-amber-800">Ganancias del grupo</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {actividad.porcentaje_grupo || 50}% de la ganancia → {formatMoney(Math.max(0, gananciaReal) * (actividad.porcentaje_grupo || 50) / 100)}
                </p>
              </div>
              <Button onClick={() => setShowGananciasGrupo(true)} variant="outline" className="w-full border-amber-300 text-amber-800 hover:bg-amber-100">
                <Banknote className="w-4 h-4 mr-2" />Acreditar / Distribuir
              </Button>
            </div>
          </Card>
        </div>
      )}

      {creditosAcreditados && (
        <Card className="p-3 mb-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Créditos ya distribuidos a {creditos.length} beneficiario(s)</span>
          </div>
        </Card>
      )}

      {/* Productos / Precios */}
      <div className="mb-6">
        <ProductosActividadPanel actividad={actividad} />
      </div>

      {/* Resumen de unidades a preparar */}
      <ResumenUnidades actividad={actividad} ventas={ventas} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por beneficiario */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />Participación por vendedor
              </CardTitle>
              <Button size="sm" onClick={() => setShowVentaForm(true)}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 max-h-[32rem] overflow-y-auto space-y-0">
            {ventas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Registrá cuánto vendió cada participante al finalizar la actividad
              </p>
            ) : (() => {
              // Nivel 1: agrupar por beneficiario
              const grupos = {};
              ventas.forEach(v => {
                const key = v.beneficiario_id || v.beneficiario_nombre;
                if (!grupos[key]) grupos[key] = { ben: getBen(v.beneficiario_id), nombre: v.beneficiario_nombre, pedidos: [] };
                grupos[key].pedidos.push(v);
              });
              return Object.values(grupos).sort((a, b) =>
                (a.ben?.nombre || a.nombre || '').localeCompare(b.ben?.nombre || b.nombre || '', 'es')
              ).map(({ ben, nombre, pedidos }) => {
                const montoGrupo = pedidos.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
                const pctGrupo = totalVentas > 0 ? Math.round((montoGrupo / totalVentas) * 100) : 0;
                const creditoEstGrupo = gananciaReal > 0 ? Math.round(gananciaReal * (actividad.porcentaje_beneficiario || 50) / 100 * pctGrupo / 100) : 0;
                const rendicionGrupo = pedidos.every(v => v.estado_rendicion === 'Rendido') ? 'Rendido'
                  : pedidos.some(v => v.estado_rendicion === 'Parcial' || v.estado_rendicion === 'Rendido') ? 'Parcial' : 'Sin rendir';
                const montoRendidoGrupo = pedidos.reduce((s, v) => s + (v.monto_rendido || (v.estado_rendicion === 'Rendido' ? v.monto_recaudado : 0) || 0), 0);

                // Nivel 2: agrupar pedidos de este vendedor por comprador
                const porComprador = {};
                pedidos.forEach(v => {
                  const cKey = v.comprador_nombre?.trim() || '__sin_comprador__';
                  if (!porComprador[cKey]) porComprador[cKey] = { comprador: v.comprador_nombre?.trim() || '', items: [] };
                  porComprador[cKey].items.push(v);
                });
                const compradorGroups = Object.values(porComprador);

                return (
                  <div key={nombre} className="border-b last:border-0">
                    {/* Cabecera del vendedor */}
                    <div className="flex items-center justify-between gap-2 py-2 bg-muted/30 px-2 rounded-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm truncate">{ben?.nombre || nombre}</p>
                          <span className="text-xs text-muted-foreground">({compradorGroups.length} pedido{compradorGroups.length > 1 ? 's' : ''})</span>
                          <span className="text-xs font-semibold text-green-700">{formatMoney(montoGrupo)} ({pctGrupo}%)</span>
                          {rendicionGrupo !== 'Sin rendir' && (
                            <span className={`text-xs font-medium ${rendicionGrupo === 'Rendido' ? 'text-green-600' : 'text-amber-600'}`}>
                              💰 {rendicionGrupo === 'Rendido' ? 'Rendido' : `Parcial: ${formatMoney(montoRendidoGrupo)}`}
                            </span>
                          )}
                        </div>
                        {gananciaReal > 0 && <p className="text-xs text-primary">Crédito est.: {formatMoney(creditoEstGrupo)}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={buildWhatsAppMsg(pedidos[0])}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Enviar resumen completo por WhatsApp"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-green-50 text-green-600 hover:text-green-700 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    {/* Pedidos agrupados por comprador */}
                    {compradorGroups.map(({ comprador, items }) => {
                      const montoPedido = items.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
                      const todoEntregado = items.every(v => v.entregado);
                      const rendicionPedido = items.every(v => v.estado_rendicion === 'Rendido') ? 'Rendido'
                        : items.some(v => v.estado_rendicion === 'Parcial' || v.estado_rendicion === 'Rendido') ? 'Parcial' : 'Sin rendir';
                      const cKey = comprador || '__sin_comprador__';
                      return (
                        <div key={cKey} className="pl-3 pr-2 py-1.5 border-t border-dashed border-border/50">
                          {/* Cabecera del pedido (comprador) */}
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                              {comprador
                                ? <span className="text-xs font-semibold text-amber-700">🛍️ {comprador}</span>
                                : <span className="text-xs text-muted-foreground italic">Sin comprador</span>}
                              <span className="text-xs font-semibold text-green-700">{formatMoney(montoPedido)}</span>
                              {todoEntregado
                                ? <span className="text-xs text-green-600">✓ Entregado</span>
                                : comprador && <span className="text-xs text-amber-600">⏳ Pendiente</span>}
                              {rendicionPedido !== 'Sin rendir' && (
                                <span className={`text-xs font-medium ${rendicionPedido === 'Rendido' ? 'text-green-600' : 'text-amber-600'}`}>
                                  · 💰 {rendicionPedido}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {/* Rendición sobre la primera línea del pedido */}
                              <Button
                                variant="ghost" size="icon"
                                className={`h-6 w-6 ${rendicionPedido === 'Rendido' ? 'text-green-600' : rendicionPedido === 'Parcial' ? 'text-amber-500' : 'text-muted-foreground'}`}
                                title="Registrar rendición"
                                onClick={() => setVentaRendicion(items[0])}
                              >
                                <Banknote className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className={`h-6 w-6 ${todoEntregado ? 'text-green-600' : 'text-muted-foreground'}`}
                                title={todoEntregado ? 'Marcar todo como NO entregado' : 'Marcar todo como entregado'}
                                onClick={() => items.forEach(v => marcarEntregadoMut.mutate({
                                  id: v.id,
                                  entregado: !todoEntregado,
                                  ...(!todoEntregado && !v.comprador_nombre ? { comprador_nombre: v.beneficiario_nombre || '' } : {}),
                                }))}
                              >
                                {todoEntregado ? <PackageCheck className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                              </Button>
                            </div>
                          </div>
                          {/* Líneas de productos dentro del pedido */}
                          {items.map(v => (
                            <div key={v.id} className="flex items-center justify-between gap-1 py-0.5 pl-3">
                              <p className="text-xs text-muted-foreground flex-1 min-w-0">
                                <span className="font-medium text-foreground/80">{v.producto_nombre || actividad.tipo_producto || '—'}</span>
                                {' · '}{v.cantidad_vendida}{v.es_promo ? ' promo(s)' : ' uds'}
                                {' · '}<span className="text-green-700">{formatMoney(v.monto_recaudado)}</span>
                              </p>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => deleteVentaMut.mutate(v.id)}>
                                <Trash2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>

        {/* Gastos de la actividad (gastos generales del grupo asociados) */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" />Gastos de la actividad
              </CardTitle>
              <Button size="sm" onClick={() => setShowGastoForm(true)}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 max-h-80 overflow-y-auto space-y-0">
            {gastosAct.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Registrá los gastos asociados a esta actividad (con facturas para rendición)
              </p>
            ) : gastosAct.map(g => (
              <div key={g.id} className="flex items-center justify-between py-2.5 border-b last:border-0 text-sm">
                <div>
                  <p className="font-medium">{g.descripcion}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.categoria}{g.fecha ? ` · ${g.fecha}` : ''}{g.proveedor ? ` · ${g.proveedor}` : ''}
                    {g.numero_factura ? ` · Fact: ${g.numero_factura}` : ''} · {g.forma_pago || 'Efectivo'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-red-500">{formatMoney(g.monto)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteGastoMut.mutate(g.id)}>
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Créditos ya acreditados */}
      {creditosAcreditados && (() => {
        // Unificar créditos por persona y ordenar alfabéticamente
        const creditosPorPersona = {};
        creditos.forEach(cr => {
          const key = cr.beneficiario_id || cr.beneficiario_nombre;
          if (!creditosPorPersona[key]) {
            creditosPorPersona[key] = { nombre: cr.beneficiario_nombre, montoOriginal: 0, montoDisponible: 0 };
          }
          creditosPorPersona[key].montoOriginal += cr.monto_original || 0;
          creditosPorPersona[key].montoDisponible += cr.monto_disponible || 0;
        });
        const creditosUnificados = Object.values(creditosPorPersona)
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
        return (
          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Gift className="w-4 h-4" />Créditos acreditados</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {creditosUnificados.map(cr => (
                <div key={cr.nombre} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <div>
                    <p className="font-medium">{cr.nombre}</p>
                    <p className="text-xs text-muted-foreground">Disponible: {formatMoney(cr.montoDisponible)}</p>
                  </div>
                  <p className="font-bold text-primary">{formatMoney(cr.montoOriginal)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      {showVentaForm && (
        <VentaForm
          open
          actividad={actividad}
          beneficiarios={beneficiarios}
          onClose={() => setShowVentaForm(false)}
          onSaved={() => { invalidateAll(); setShowVentaForm(false); }}
        />
      )}
      {showGastoForm && (
        <GastoActividadForm
          open
          actividad={actividad}
          onClose={() => setShowGastoForm(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['gastos-actividad', actividad.id] }); setShowGastoForm(false); }}
        />
      )}
      {showReporte && (
        <ReporteVentasDialog
          open
          actividad={actividad}
          ventas={ventas}
          beneficiarios={beneficiarios}
          onClose={() => setShowReporte(false)}
        />
      )}
      {ventaRendicion && (
        <RendicionDialog
          open
          venta={ventaRendicion}
          actividadId={actividad.id}
          onClose={() => setVentaRendicion(null)}
        />
      )}
      {showRendicionMasiva && (
        <RendicionMasivaDialog
          open
          ventas={ventas}
          actividadId={actividad.id}
          onClose={() => setShowRendicionMasiva(false)}
        />
      )}
      {showDistribuir && (
        <DistribuirCreditosDialog
          open
          actividad={actividad}
          ventas={ventas}
          gananciaReal={gananciaReal}
          beneficiarios={beneficiarios}
          onClose={() => setShowDistribuir(false)}
          onSaved={() => { invalidateAll(); setShowDistribuir(false); onSaved(); }}
        />
      )}
      {showGananciasGrupo && (
        <GananciasGrupoDialog
          open
          actividad={actividad}
          gananciaReal={gananciaReal}
          beneficiarios={beneficiarios}
          onClose={() => setShowGananciasGrupo(false)}
          onSaved={() => { setShowGananciasGrupo(false); onSaved(); }}
        />
      )}
    </div>
  );
}