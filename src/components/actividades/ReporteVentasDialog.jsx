import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileSpreadsheet, PackageCheck, Package, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';

// Helper: extraer apellido para ordenar (última palabra del nombre)
function apellido(nombre = '') {
  const partes = nombre.trim().split(/\s+/);
  return partes[partes.length - 1].toLowerCase();
}

// Orden de prioridad de ramas
const RAMA_ORDER = {
  'Lobatos': 1,
  'Tropa': 2,
  'KM': 3,
  'Rovers': 4,
  'Voluntario': 5,
  'Educador': 5,
};
const RAMA_LABEL = {
  'Lobatos': 'Lobatos',
  'Tropa': 'Tropa',
  'KM': 'Caminantes',
  'Rovers': 'Rovers',
  'Voluntario': 'Adultos',
  'Educador': 'Adultos',
};

// Estado rendición helpers
const RENDICION_CONFIG = {
  'Sin rendir':  { label: 'Sin rendir',  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  'Parcial':     { label: 'Parcial',     color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  'Rendido':     { label: 'Rendido ✓',   color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
};

function getRendicion(v) {
  return RENDICION_CONFIG[v.estado_rendicion || 'Sin rendir'];
}

function getSaldo(v) {
  const rendido = v.monto_rendido || 0;
  const total = v.monto_recaudado || 0;
  return total - rendido;
}

export default function ReporteVentasDialog({ open, onClose, actividad, ventas, beneficiarios = [] }) {
  const printRef = useRef();

  const { data: productos = [] } = useQuery({
    queryKey: ['productos-actividad', actividad?.id],
    queryFn: () => base44.entities.ProductoActividad.filter({ actividad_id: actividad.id }),
    enabled: !!actividad?.id,
  });

  const totalRecaudado = ventas.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
  const totalUnidades = ventas.reduce((s, v) => {
    const uds = v.es_promo && v.cantidad_promo ? (v.cantidad_vendida || 0) * v.cantidad_promo : (v.cantidad_vendida || 0);
    return s + uds;
  }, 0);
  const totalRendido = ventas.reduce((s, v) => s + (v.monto_rendido || (v.estado_rendicion === 'Rendido' ? v.monto_recaudado : 0) || 0), 0);
  const totalSaldo = totalRecaudado - totalRendido;
  const entregadas = ventas.filter(v => v.entregado).length;
  const pendientes = ventas.filter(v => !v.entregado).length;

  // Desglose de unidades por grupo/producto
  const grupoMap = {};
  productos.forEach(p => { grupoMap[p.id] = p.grupo || p.nombre; });
  const porGrupo = {};
  ventas.forEach(v => {
    const grupo = grupoMap[v.producto_id] || v.producto_nombre || actividad?.tipo_producto || 'Producto';
    if (!porGrupo[grupo]) porGrupo[grupo] = { unidades: 0, detalles: [] };
    const uds = v.es_promo ? (v.cantidad_vendida || 0) * (v.cantidad_promo || 1) : (v.cantidad_vendida || 0);
    porGrupo[grupo].unidades += uds;
    porGrupo[grupo].detalles.push({
      nombre: v.producto_nombre || actividad?.tipo_producto || 'Producto',
      unidades: uds,
      cantidad_vendida: v.cantidad_vendida || 0,
      es_promo: v.es_promo,
      cantidad_promo: v.cantidad_promo,
    });
  });
  const gruposDesglose = Object.entries(porGrupo).sort((a, b) => a[0].localeCompare(b[0], 'es'));

  // Agrupar por vendedor
  const ventasPorVendedor = {};
  ventas.forEach(v => {
    const key = v.beneficiario_id || v.beneficiario_nombre;
    if (!ventasPorVendedor[key]) {
      const ben = beneficiarios.find(b => b.id === v.beneficiario_id);
      ventasPorVendedor[key] = { nombre: v.beneficiario_nombre, ventas: [], rama: ben?.rama || '', ben };
    }
    ventasPorVendedor[key].ventas.push(v);
  });

  // Ordenar vendedores: primero por grupo de rama (Lobatos, Tropa, Caminantes, Rovers, Adultos), luego por apellido
  const vendedoresOrdenados = Object.values(ventasPorVendedor).sort((a, b) => {
    const ga = a.rama ? (RAMA_LABEL[a.rama] || a.rama) : '__sin_rama__';
    const gb = b.rama ? (RAMA_LABEL[b.rama] || b.rama) : '__sin_rama__';
    if (ga !== gb) return (RAMA_ORDER[a.rama] ?? 99) - (RAMA_ORDER[b.rama] ?? 99);
    return apellido(a.nombre).localeCompare(apellido(b.nombre), 'es');
  });

  // Dentro de cada vendedor, ordenar sus ventas por comprador_nombre (alfabéticamente)
  vendedoresOrdenados.forEach(v => {
    v.ventas.sort((a, b) => {
      const na = (a.comprador_nombre || '').toLowerCase();
      const nb = (b.comprador_nombre || '').toLowerCase();
      return na.localeCompare(nb, 'es');
    });
  });

  // Agrupar vendedores por rama preservando el orden
  // Usar RAMA_LABEL como clave para que Voluntario y Educador se agrupen juntos bajo "Adultos"
  const ramaSections = [];
  let currentGroup = null;
  vendedoresOrdenados.forEach(v => {
    const groupKey = v.rama ? (RAMA_LABEL[v.rama] || v.rama) : '__sin_rama__';
    if (groupKey !== currentGroup) {
      currentGroup = groupKey;
      ramaSections.push({ rama: v.rama, groupLabel: groupKey, vendedores: [v] });
    } else {
      ramaSections[ramaSections.length - 1].vendedores.push(v);
    }
  });

  // ---- EXPORTAR XLS (tabla HTML que Excel abre perfectamente) ----
  const handleExportXLS = () => {
    const fmt = (n) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let rn = 0;

    const filas = ramaSections.map(({ rama, vendedores }) => {
      const ramaLabel = rama ? RAMA_LABEL[rama] || rama : 'Sin rama';
      const ramaHeader = `<tr style="background:#d1d5e8">
        <td colspan="10" style="padding:8px 10px;border:1px solid #9ca3c0;font-weight:bold;font-size:12px;color:#312e81;text-transform:uppercase">${ramaLabel}</td>
      </tr>`;
      const vendedorFilas = vendedores.map(({ nombre, ventas: vv }) => {
      const subtotal = vv.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
      const subRendido = vv.reduce((s, v) => s + (v.monto_rendido || (v.estado_rendicion === 'Rendido' ? v.monto_recaudado : 0) || 0), 0);
      const subSaldo = subtotal - subRendido;

      const subFilas = vv.map(v => {
        rn++;
        const rendidoEfectivo = v.monto_rendido || (v.estado_rendicion === 'Rendido' ? v.monto_recaudado : 0) || 0;
        const saldo = getSaldo(v);
        return `<tr>
          <td style="padding:5px 8px;border:1px solid #ddd;color:#888">${rn}</td>
          <td style="padding:5px 8px 5px 20px;border:1px solid #ddd">${nombre}</td>
          <td style="padding:5px 8px 5px 20px;border:1px solid #ddd">${v.producto_nombre || '—'}</td>
          <td style="padding:5px 8px 5px 20px;border:1px solid #ddd">${v.comprador_nombre || '—'}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${v.cantidad_vendida || '—'}${v.es_promo && v.cantidad_promo ? ` (${v.cantidad_vendida * v.cantidad_promo} uds)` : ''}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right">${fmt(v.monto_recaudado)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${v.entregado ? 'Entregado' : 'Pendiente'}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${v.estado_rendicion || 'Sin rendir'}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right">${rendidoEfectivo > 0 ? fmt(rendidoEfectivo) : '—'}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;color:${saldo > 0 ? '#dc2626' : '#16a34a'}">${saldo > 0 ? fmt(saldo) : '—'}</td>
        </tr>`;
      }).join('');

      const vendedorFila = `<tr style="background:#e8eeff">
        <td colspan="4" style="padding:6px 8px;border:1px solid #b0b8e0;font-weight:bold;color:#2a3d9e">${nombre}</td>
        <td style="padding:6px 8px;border:1px solid #b0b8e0"></td>
        <td style="padding:6px 8px;border:1px solid #b0b8e0;text-align:right;font-weight:bold;color:#15803d">${fmt(subtotal)}</td>
        <td style="padding:6px 8px;border:1px solid #b0b8e0"></td>
        <td style="padding:6px 8px;border:1px solid #b0b8e0;text-align:center;font-weight:bold;color:${subSaldo <= 0 ? '#15803d' : '#b45309'}">${subSaldo <= 0 ? 'Todo rendido' : 'Saldo pend.'}</td>
        <td style="padding:6px 8px;border:1px solid #b0b8e0"></td>
        <td style="padding:6px 8px;border:1px solid #b0b8e0;text-align:right;font-weight:bold;color:#dc2626">${subSaldo > 0 ? fmt(subSaldo) : '—'}</td>
      </tr>`;

        return vendedorFila + subFilas;
      }).join('');
      return ramaHeader + vendedorFilas;
    }).join('');

    const desgloseRows = gruposDesglose.length > 0 ? `
      <h3 style="font-family:Arial;font-size:13px;margin:16px 0 4px;color:#312e81">Unidades a preparar por producto</h3>
      <table style="margin-bottom:12px">
        <thead><tr style="background:#e0e7ff">
          <th style="padding:6px 8px;border:1px solid #c7d2fe;text-align:left">Producto / Grupo</th>
          <th style="padding:6px 8px;border:1px solid #c7d2fe;text-align:left">Detalle</th>
          <th style="padding:6px 8px;border:1px solid #c7d2fe;text-align:right">Unidades</th>
        </tr></thead>
        <tbody>
          ${gruposDesglose.map(([grupo, data]) => {
            const merged = {};
            data.detalles.forEach(d => {
              const key = d.es_promo ? `${d.nombre} (promo x${d.cantidad_promo})` : d.nombre;
              if (!merged[key]) merged[key] = { ...d, count: 0, unidades: 0 };
              merged[key].count += d.cantidad_vendida;
              merged[key].unidades += d.unidades;
            });
            const detalleStr = Object.values(merged).map(d =>
              d.es_promo
                ? `${d.nombre}: ${d.count} promo${d.count !== 1 ? 's' : ''} de ${d.cantidad_promo} (${d.unidades} uds)`
                : `${d.nombre}: ${d.count} individual${d.count !== 1 ? 'es' : ''} (${d.unidades} uds)`
            ).join(' · ');
            return `<tr>
              <td style="padding:5px 8px;border:1px solid #ddd;font-weight:bold">${grupo}</td>
              <td style="padding:5px 8px;border:1px solid #ddd;font-size:10px;color:#555">${detalleStr}</td>
              <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;font-size:14px;color:#312e81">${data.unidades}</td>
            </tr>`;
          }).join('')}
          <tr style="background:#dcfce7;font-weight:bold">
            <td colspan="2" style="padding:7px 8px;border:1px solid #86efac">TOTAL GENERAL</td>
            <td style="padding:7px 8px;border:1px solid #86efac;text-align:right;font-size:14px;color:#15803d">${totalUnidades}</td>
          </tr>
        </tbody>
      </table>` : '';

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #f3f4f6; padding: 7px 8px; border: 1px solid #ccc; font-size: 10px; text-transform: uppercase; text-align: left; }
      </style>
      </head>
      <body>
        <h2 style="font-family:Arial;font-size:16px;margin-bottom:2px">${actividad.nombre}</h2>
        <p style="font-family:Arial;font-size:11px;color:#666;margin-bottom:16px">
          ${actividad.tipo_producto ? actividad.tipo_producto + ' · ' : ''}Fecha: ${actividad.fecha || ''}
        </p>
        ${desgloseRows}
        <table>
          <thead>
            <tr>
              <th>#</th><th>Vendedor</th><th>Producto</th><th>Quien retira</th>
              <th>Cant.</th><th>Monto</th><th>Entrega</th>
              <th>Rendición</th><th>Monto rendido</th><th>Saldo pendiente</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
            <tr style="background:#dcfce7;font-weight:bold">
              <td colspan="4" style="padding:7px 8px;border:1px solid #86efac">TOTAL GENERAL</td>
              <td style="padding:7px 8px;border:1px solid #86efac;text-align:center">${totalUnidades || '—'}</td>
              <td style="padding:7px 8px;border:1px solid #86efac;text-align:right;color:#15803d">${fmt(totalRecaudado)}</td>
              <td style="padding:7px 8px;border:1px solid #86efac"></td>
              <td style="padding:7px 8px;border:1px solid #86efac;text-align:center;color:#1d4ed8">${fmt(totalRendido)}</td>
              <td style="padding:7px 8px;border:1px solid #86efac"></td>
              <td style="padding:7px 8px;border:1px solid #86efac;text-align:right;color:#dc2626">${totalSaldo > 0 ? fmt(totalSaldo) : '—'}</td>
            </tr>
          </tbody>
        </table>
      </body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventas_${actividad.nombre.replace(/\s+/g, '_')}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- IMPRIMIR ----
  const handlePrint = () => {
    const contenido = printRef.current.innerHTML;
    const ventana = window.open('', '_blank');
    ventana.document.write(`
      <html>
      <head>
        <title>Reporte de Ventas — ${actividad.nombre}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
          h1 { font-size: 17px; margin-bottom: 2px; }
          .sub { color: #666; font-size: 11px; margin-bottom: 14px; }
          .resumen { display: flex; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
          .resumen-item { border: 1px solid #ddd; border-radius: 6px; padding: 6px 12px; min-width: 90px; text-align:center; }
          .resumen-item .label { font-size: 9px; color: #888; text-transform: uppercase; }
          .resumen-item .valor { font-size: 15px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th { background: #f3f4f6; text-align: left; padding: 6px 8px; border-bottom: 2px solid #ccc; font-size: 10px; text-transform: uppercase; }
          td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
          .vendedor-row td { background: #f0f4ff !important; font-weight: bold; border-top: 1px solid #c7d2fe; }
          .sub-row td { padding-left: 20px; }
          .sub-row:last-child td { border-bottom: 2px solid #c7d2fe; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .estado-entregado { color: #16a34a; font-weight: 600; }
          .estado-pendiente { color: #b45309; }
          .rendido-ok { color: #15803d; font-weight: 600; }
          .rendido-parcial { color: #b45309; font-weight: 600; }
          .rendido-no { color: #dc2626; }
          .total-row td { background: #dcfce7 !important; font-weight: bold; border-top: 2px solid #86efac; }
          @media print { button { display: none !important; } }
        </style>
      </head>
      <body>${contenido}</body>
      </html>
    `);
    ventana.document.close();
    ventana.focus();
    ventana.print();
    ventana.close();
  };

  let rowNum = 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reporte de ventas — {actividad.nombre}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end gap-2 mb-2">
          <Button onClick={handleExportXLS} variant="outline" className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />Exportar XLS
          </Button>
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" />Imprimir / PDF
          </Button>
        </div>

        <div ref={printRef}>
          {/* Encabezado */}
          <h1 className="text-xl font-bold mb-0.5">{actividad.nombre}</h1>
          <p className="sub text-sm text-muted-foreground mb-4">
            {actividad.tipo_producto && `${actividad.tipo_producto} · `}
            Fecha: {actividad.fecha}
          </p>

          {/* Resumen */}
          <div className="resumen flex gap-3 flex-wrap mb-6">
            {[
              { label: 'Vendedores', valor: vendedoresOrdenados.length, color: '' },
              { label: 'Pedidos', valor: ventas.length, color: '' },
              { label: 'Unidades', valor: totalUnidades || '—', color: '' },
              { label: 'Recaudado', valor: formatMoney(totalRecaudado), color: 'text-green-700' },
              { label: 'Rendido', valor: formatMoney(totalRendido), color: 'text-blue-700' },
              { label: 'Saldo pend.', valor: formatMoney(totalSaldo), color: totalSaldo > 0 ? 'text-red-600' : 'text-green-600' },
              { label: 'Entregados', valor: entregadas, color: 'text-green-600' },
              { label: 'Pendientes', valor: pendientes, color: 'text-amber-600' },
            ].map(item => (
              <div key={item.label} className="resumen-item border rounded-lg px-3 py-2 text-center">
                <div className="label text-xs text-muted-foreground uppercase tracking-wide">{item.label}</div>
                <div className={`valor text-lg font-bold ${item.color}`}>{item.valor}</div>
              </div>
            ))}
          </div>

          {/* Resumen de unidades a preparar */}
          {gruposDesglose.length > 0 && (
            <div className="mb-6 border border-primary/20 bg-primary/5 rounded-lg p-4">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Unidades a preparar por producto
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {gruposDesglose.map(([grupo, data]) => (
                  <div key={grupo} className="rounded-lg bg-white/70 border border-primary/15 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm">{grupo}</p>
                      <p className="text-2xl font-bold text-primary">{data.unidades}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1.5">unidad{data.unidades !== 1 ? 'es' : ''} en total</p>
                    <div className="space-y-0.5">
                      {(() => {
                        const merged = {};
                        data.detalles.forEach(d => {
                          const key = d.es_promo ? `${d.nombre} (promo x${d.cantidad_promo})` : d.nombre;
                          if (!merged[key]) merged[key] = { ...d, count: 0, unidades: 0 };
                          merged[key].count += d.cantidad_vendida;
                          merged[key].unidades += d.unidades;
                        });
                        return Object.values(merged).map(d => (
                          <div key={`${d.nombre}-${d.es_promo}-${d.cantidad_promo}`} className="flex justify-between text-xs gap-2">
                            <span className="text-muted-foreground min-w-0 truncate">
                              <span className="font-medium text-foreground/70">{d.nombre}</span>
                              {d.es_promo
                                ? ` · ${d.count} promo${d.count !== 1 ? 's' : ''} de ${d.cantidad_promo}`
                                : ` · ${d.count} individual${d.count !== 1 ? 'es' : ''}`}
                            </span>
                            <span className="font-medium text-foreground/80 shrink-0">{d.unidades} uds</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-primary/15 flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground">Total general de unidades</p>
                <p className="text-2xl font-bold text-primary">{totalUnidades}</p>
              </div>
            </div>
          )}

          {/* Tabla agrupada por vendedor */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60">
                <th className="text-left px-2 py-1 text-xs uppercase text-muted-foreground border-b-2 border-border w-6">#</th>
                <th className="text-left px-2 py-1 text-xs uppercase text-muted-foreground border-b-2 border-border">Producto</th>
                <th className="text-left px-2 py-1 text-xs uppercase text-muted-foreground border-b-2 border-border">Quien retira</th>
                <th className="text-center px-2 py-1 text-xs uppercase text-muted-foreground border-b-2 border-border">Cant.</th>
                <th className="text-right px-2 py-1 text-xs uppercase text-muted-foreground border-b-2 border-border">Monto</th>
                <th className="text-center px-2 py-1 text-xs uppercase text-muted-foreground border-b-2 border-border">Entrega</th>
                <th className="text-center px-2 py-1 text-xs uppercase text-muted-foreground border-b-2 border-border">Rendición</th>
                <th className="text-right px-2 py-1 text-xs uppercase text-muted-foreground border-b-2 border-border">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {ramaSections.map(({ rama, vendedores }) => (
                <React.Fragment key={rama || '__sin_rama__'}>
                  <tr className="rama-row">
                    <td colSpan={8} className="px-2 py-1.5 bg-slate-200 font-bold text-xs uppercase text-slate-700 tracking-wide border-y-2 border-slate-300">
                      {rama ? RAMA_LABEL[rama] || rama : 'Sin rama'}
                    </td>
                  </tr>
                  {vendedores.map(({ nombre, ventas: vv }) => {
                const subtotal = vv.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
                const subRendido = vv.reduce((s, v) => s + (v.monto_rendido || (v.estado_rendicion === 'Rendido' ? v.monto_recaudado : 0) || 0), 0);
                const subSaldo = subtotal - subRendido;
                return (
                  <React.Fragment key={nombre}>
                    {/* Fila del vendedor */}
                    <tr className="vendedor-row bg-primary/5 border-t border-primary/20">
                     <td colSpan={4} className="px-2 py-1 font-bold text-sm text-primary">
                       {nombre}
                     </td>
                     <td className="px-2 py-1 text-right font-bold text-green-700">{formatMoney(subtotal)}</td>
                     <td />
                     <td className="px-2 py-1 text-center text-xs font-semibold">
                       {subSaldo <= 0
                         ? <span className="text-green-700">✓ Todo rendido</span>
                         : <span className="text-amber-700">Saldo: {formatMoney(subSaldo)}</span>
                       }
                     </td>
                     <td className="px-2 py-1 text-right font-bold text-red-600 text-xs">
                       {subSaldo > 0 ? formatMoney(subSaldo) : '—'}
                     </td>
                    </tr>
                    {/* Filas de pedidos del vendedor */}
                    {vv.map(v => {
                     rowNum++;
                     const rend = getRendicion(v);
                     const saldo = getSaldo(v);
                     const rendidoEfectivo = v.monto_rendido || (v.estado_rendicion === 'Rendido' ? v.monto_recaudado : 0) || 0;
                     return (
                       <tr key={v.id} className="sub-row border-b">
                         <td className="px-2 py-0.5 text-muted-foreground text-xs pl-4">{rowNum}</td>
                         <td className="px-2 py-0.5 pl-6 text-xs">
                           {v.producto_nombre
                             ? <span className="font-medium text-primary/80">{v.producto_nombre}{v.es_promo ? ` (${v.cantidad_promo}x)` : ''}</span>
                             : <span className="text-muted-foreground italic">—</span>}
                         </td>
                         <td className="px-2 py-0.5 pl-6">
                           {v.comprador_nombre
                             ? <span className="text-amber-700 font-medium">🛍️ {v.comprador_nombre}</span>
                             : <span className="text-muted-foreground text-xs italic">—</span>}
                         </td>
                         <td className="px-2 py-0.5 text-center">
                           {v.cantidad_vendida > 0 ? (
                             <span>{v.cantidad_vendida}{v.es_promo && v.cantidad_promo ? <span className="text-xs text-muted-foreground"> ({v.cantidad_vendida * v.cantidad_promo} uds)</span> : ''}</span>
                           ) : '—'}
                         </td>
                         <td className="px-2 py-0.5 text-right font-semibold text-green-600">
                           {formatMoney(v.monto_recaudado || 0)}
                         </td>
                         <td className="px-2 py-0.5 text-center">
                           {v.entregado
                             ? <span className="inline-flex items-center gap-1 text-green-700 text-xs font-semibold">
                                 <PackageCheck className="w-3 h-3" />✓
                               </span>
                             : <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                                 <Package className="w-3 h-3" />⏳
                               </span>}
                         </td>
                         <td className="px-2 py-0.5 text-center">
                           <span className={`inline-block text-xs font-semibold px-1.5 py-0 rounded border ${rend.color} ${rend.bg} ${rend.border}`}>
                             {rend.label}
                             {v.estado_rendicion === 'Parcial' && rendidoEfectivo > 0 && (
                               <span className="ml-1 font-normal">({formatMoney(rendidoEfectivo)})</span>
                             )}
                           </span>
                         </td>
                         <td className="px-2 py-0.5 text-right text-xs font-bold">
                           {saldo > 0
                             ? <span className="text-red-600">{formatMoney(saldo)}</span>
                             : <span className="text-green-600">—</span>}
                         </td>
                       </tr>
                     );
                    })}
                    </React.Fragment>
                    );
                    })}
                    </React.Fragment>
                    ))}
                    {/* Fila total */}
              <tr className="total-row bg-green-50 border-t-2 border-green-300">
                <td colSpan={3} className="px-2 py-1 text-sm font-bold">TOTAL GENERAL</td>
                <td className="px-2 py-1 text-center font-bold">{totalUnidades || '—'}</td>
                <td className="px-2 py-1 text-right font-bold text-green-700 text-base">{formatMoney(totalRecaudado)}</td>
                <td className="px-2 py-1 text-center text-xs text-muted-foreground">
                  {entregadas}✓ / {pendientes}⏳
                </td>
                <td className="px-2 py-1 text-center text-xs font-bold text-blue-700">{formatMoney(totalRendido)}</td>
                <td className="px-2 py-1 text-right font-bold text-red-600 text-sm">
                  {totalSaldo > 0 ? formatMoney(totalSaldo) : '—'}
                </td>
              </tr>
            </tbody>
          </table>

          {ventas.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No hay ventas registradas</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}