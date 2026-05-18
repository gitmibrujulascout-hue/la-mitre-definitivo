import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileSpreadsheet, PackageCheck, Package, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';

// Helper: extraer apellido para ordenar (última palabra del nombre)
function apellido(nombre = '') {
  const partes = nombre.trim().split(/\s+/);
  return partes[partes.length - 1].toLowerCase();
}

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

export default function ReporteVentasDialog({ open, onClose, actividad, ventas }) {
  const printRef = useRef();

  const totalRecaudado = ventas.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
  const totalUnidades = ventas.reduce((s, v) => s + (v.cantidad_vendida || 0), 0);
  const totalRendido = ventas.reduce((s, v) => s + (v.monto_rendido || (v.estado_rendicion === 'Rendido' ? v.monto_recaudado : 0) || 0), 0);
  const totalSaldo = totalRecaudado - totalRendido;
  const entregadas = ventas.filter(v => v.entregado).length;
  const pendientes = ventas.filter(v => !v.entregado).length;

  // Agrupar por vendedor, ordenado alfabéticamente por apellido
  const ventasPorVendedor = {};
  ventas.forEach(v => {
    const key = v.beneficiario_id || v.beneficiario_nombre;
    if (!ventasPorVendedor[key]) {
      ventasPorVendedor[key] = { nombre: v.beneficiario_nombre, ventas: [] };
    }
    ventasPorVendedor[key].ventas.push(v);
  });

  // Ordenar vendedores por apellido
  const vendedoresOrdenados = Object.values(ventasPorVendedor).sort((a, b) =>
    apellido(a.nombre).localeCompare(apellido(b.nombre), 'es')
  );

  // Dentro de cada vendedor, ordenar sus ventas por comprador_nombre (alfabéticamente)
  vendedoresOrdenados.forEach(v => {
    v.ventas.sort((a, b) => {
      const na = (a.comprador_nombre || '').toLowerCase();
      const nb = (b.comprador_nombre || '').toLowerCase();
      return na.localeCompare(nb, 'es');
    });
  });

  // ---- EXPORTAR XLS (tabla HTML que Excel abre perfectamente) ----
  const handleExportXLS = () => {
    const fmt = (n) => (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let rn = 0;

    const filas = vendedoresOrdenados.map(({ nombre, ventas: vv }) => {
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
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${v.cantidad_vendida || '—'}</td>
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

          {/* Tabla agrupada por vendedor */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60">
                <th className="text-left p-2 text-xs uppercase text-muted-foreground border-b-2 border-border w-6">#</th>
                <th className="text-left p-2 text-xs uppercase text-muted-foreground border-b-2 border-border">Producto</th>
                <th className="text-left p-2 text-xs uppercase text-muted-foreground border-b-2 border-border">Quien retira</th>
                <th className="text-center p-2 text-xs uppercase text-muted-foreground border-b-2 border-border">Cant.</th>
                <th className="text-right p-2 text-xs uppercase text-muted-foreground border-b-2 border-border">Monto</th>
                <th className="text-center p-2 text-xs uppercase text-muted-foreground border-b-2 border-border">Entrega</th>
                <th className="text-center p-2 text-xs uppercase text-muted-foreground border-b-2 border-border">Rendición</th>
                <th className="text-right p-2 text-xs uppercase text-muted-foreground border-b-2 border-border">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {vendedoresOrdenados.map(({ nombre, ventas: vv }) => {
                const subtotal = vv.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
                const subRendido = vv.reduce((s, v) => s + (v.monto_rendido || (v.estado_rendicion === 'Rendido' ? v.monto_recaudado : 0) || 0), 0);
                const subSaldo = subtotal - subRendido;
                return (
                  <React.Fragment key={nombre}>
                    {/* Fila del vendedor */}
                    <tr className="vendedor-row bg-primary/5 border-t border-primary/20">
                      <td colSpan={4} className="p-2 font-bold text-sm text-primary">
                        {nombre}
                      </td>
                      <td className="p-2 text-right font-bold text-green-700">{formatMoney(subtotal)}</td>
                      <td />
                      <td className="p-2 text-center text-xs font-semibold">
                        {subSaldo <= 0
                          ? <span className="text-green-700">✓ Todo rendido</span>
                          : <span className="text-amber-700">Saldo: {formatMoney(subSaldo)}</span>
                        }
                      </td>
                      <td className="p-2 text-right font-bold text-red-600 text-xs">
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
                          <td className="p-2 text-muted-foreground text-xs pl-4">{rowNum}</td>
                          <td className="p-2 pl-6 text-xs">
                            {v.producto_nombre
                              ? <span className="font-medium text-primary/80">{v.producto_nombre}{v.es_promo ? ` (${v.cantidad_promo}x)` : ''}</span>
                              : <span className="text-muted-foreground italic">—</span>}
                          </td>
                          <td className="p-2 pl-6">
                            {v.comprador_nombre
                              ? <span className="text-amber-700 font-medium">🛍️ {v.comprador_nombre}</span>
                              : <span className="text-muted-foreground text-xs italic">—</span>}
                          </td>
                          <td className="p-2 text-center">
                            {v.cantidad_vendida > 0 ? v.cantidad_vendida : '—'}
                          </td>
                          <td className="p-2 text-right font-semibold text-green-600">
                            {formatMoney(v.monto_recaudado || 0)}
                          </td>
                          <td className="p-2 text-center">
                            {v.entregado
                              ? <span className="inline-flex items-center gap-1 text-green-700 text-xs font-semibold">
                                  <PackageCheck className="w-3 h-3" />✓
                                </span>
                              : <span className="inline-flex items-center gap-1 text-amber-700 text-xs">
                                  <Package className="w-3 h-3" />⏳
                                </span>}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${rend.color} ${rend.bg} ${rend.border}`}>
                              {rend.label}
                              {v.estado_rendicion === 'Parcial' && rendidoEfectivo > 0 && (
                                <span className="ml-1 font-normal">({formatMoney(rendidoEfectivo)})</span>
                              )}
                            </span>
                          </td>
                          <td className="p-2 text-right text-xs font-bold">
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
              {/* Fila total */}
              <tr className="total-row bg-green-50 border-t-2 border-green-300">
                <td colSpan={3} className="p-2 text-sm font-bold">TOTAL GENERAL</td>
                <td className="p-2 text-center font-bold">{totalUnidades || '—'}</td>
                <td className="p-2 text-right font-bold text-green-700 text-base">{formatMoney(totalRecaudado)}</td>
                <td className="p-2 text-center text-xs text-muted-foreground">
                  {entregadas}✓ / {pendientes}⏳
                </td>
                <td className="p-2 text-center text-xs font-bold text-blue-700">{formatMoney(totalRendido)}</td>
                <td className="p-2 text-right font-bold text-red-600 text-sm">
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