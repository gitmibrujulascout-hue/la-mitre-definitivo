import React, { useMemo, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Printer, Package, Users } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';

const ESTADOS_ACTIVOS = ['Pendiente', 'Confirmado'];

export default function ReporteEncargosDialog({ encargos, onClose }) {
  const [filtro, setFiltro] = useState('activos');
  const printRef = useRef();

  const encargosFiltrados = useMemo(() => {
    if (filtro === 'todos') return encargos;
    if (filtro === 'activos') return encargos.filter(e => ESTADOS_ACTIVOS.includes(e.estado));
    return encargos.filter(e => e.estado === filtro);
  }, [encargos, filtro]);

  // ---- Pedido al proveedor: producto × talle → cantidad total ----
  const pedidoProveedor = useMemo(() => {
    const map = {}; // { productoNombre: { talles: { talle: cantidad }, total: n, sinTalle: n } }
    encargosFiltrados.forEach(e => {
      if (!map[e.producto_nombre]) map[e.producto_nombre] = { talles: {}, total: 0 };
      const talle = e.talle || '_sin_talle_';
      map[e.producto_nombre].talles[talle] = (map[e.producto_nombre].talles[talle] || 0) + (e.cantidad || 0);
      map[e.producto_nombre].total += (e.cantidad || 0);
    });
    // Recolectar todos los talles únicos
    const todosTalles = new Set();
    Object.values(map).forEach(p => Object.keys(p.talles).forEach(t => todosTalles.add(t)));
    const tallesOrdenados = Array.from(todosTalles).sort((a, b) => {
      if (a === '_sin_talle_') return 1;
      if (b === '_sin_talle_') return -1;
      // Intentar orden numérico si ambos son números
      const na = parseFloat(a), nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b, 'es');
    });
    return { map, talles: tallesOrdenados };
  }, [encargosFiltrados]);

  // ---- Lista de entrega: por beneficiario ----
  const listaEntrega = useMemo(() => {
    const porBen = {};
    encargosFiltrados.forEach(e => {
      const key = e.beneficiario_id || e.beneficiario_nombre;
      if (!porBen[key]) porBen[key] = { nombre: e.beneficiario_nombre, items: [] };
      porBen[key].items.push(e);
    });
    return Object.values(porBen).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [encargosFiltrados]);

  const totalUnidades = encargosFiltrados.reduce((s, e) => s + (e.cantidad || 0), 0);
  const totalMonto = encargosFiltrados.reduce((s, e) => s + (e.monto_total || 0), 0);

  // ---- Exportar XLS ----
  const handleExportXLS = () => {
    const { map: pedido, talles } = pedidoProveedor;

    // Hoja 1: Pedido al proveedor
    const talleHeaderCols = talles.map(t =>
      `<th style="padding:6px 8px;border:1px solid #c7d2fe;text-align:center">${t === '_sin_talle_' ? 'Sin talle' : t}</th>`
    ).join('');
    const talleTotalCols = talles.length + 1;

    const pedidoFilas = Object.entries(pedido).sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([nombre, data]) => {
      const talleCells = talles.map(t => {
        const val = data.talles[t] || 0;
        return `<td style="padding:5px 8px;border:1px solid #ddd;text-align:center${val > 0 ? ';font-weight:bold' : ';color:#ccc'}">${val > 0 ? val : ''}</td>`;
      }).join('');
      return `<tr>
        <td style="padding:5px 8px;border:1px solid #ddd;font-weight:bold">${nombre}</td>
        ${talleCells}
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;color:#15803d">${data.total}</td>
      </tr>`;
    }).join('');

    const totalTalleCells = talles.map(t => {
      const sum = Object.values(pedido).reduce((s, p) => s + (p.talles[t] || 0), 0);
      return `<td style="padding:7px 8px;border:1px solid #86efac;text-align:center;font-weight:bold">${sum}</td>`;
    }).join('');

    // Hoja 2: Lista de entrega
    let rn = 0;
    const entregaFilas = listaEntrega.map(({ nombre, items }) => {
      const subTotal = items.reduce((s, i) => s + (i.monto_total || 0), 0);
      const subUnidades = items.reduce((s, i) => s + (i.cantidad || 0), 0);
      const benHeader = `<tr style="background:#e8eeff">
        <td colspan="4" style="padding:6px 8px;border:1px solid #b0b8e0;font-weight:bold;color:#2a3d9e">${nombre}</td>
        <td style="padding:6px 8px;border:1px solid #b0b8e0;text-align:center;font-weight:bold">${subUnidades}</td>
        <td style="padding:6px 8px;border:1px solid #b0b8e0;text-align:right;font-weight:bold;color:#15803d">${formatMoney(subTotal)}</td>
        <td style="padding:6px 8px;border:1px solid #b0b8e0;text-align:center">${items[0]?.estado || ''}</td>
      </tr>`;
      const itemFilas = items.map(i => {
        rn++;
        return `<tr>
          <td style="padding:5px 8px;border:1px solid #ddd;color:#888">${rn}</td>
          <td style="padding:5px 8px 5px 20px;border:1px solid #ddd">${i.producto_nombre}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${i.talle || '—'}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${i.cantidad || 0}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right">${formatMoney(i.precio_unitario || 0)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:bold">${formatMoney(i.monto_total || 0)}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${i.estado}</td>
        </tr>`;
      }).join('');
      return benHeader + itemFilas;
    }).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th { background: #f3f4f6; padding: 7px 8px; border: 1px solid #ccc; font-size: 10px; text-transform: uppercase; text-align: left; }
        h2 { font-size: 15px; margin: 18px 0 4px; color: #312e81; }
        h3 { font-size: 13px; margin: 14px 0 4px; color: #312e81; }
      </style>
      </head>
      <body>
        <h2>Reporte de Pre-encargos — Tienda</h2>
        <p style="font-size:11px;color:#666">Filtro: ${filtro === 'activos' ? 'Activos (Pendiente + Confirmado)' : filtro === 'todos' ? 'Todos' : filtro} · ${encargosFiltrados.length} encargo(s) · ${totalUnidades} unidades · ${formatMoney(totalMonto)}</p>

        <h3>Pedido al proveedor</h3>
        <table>
          <thead>
            <tr style="background:#e0e7ff">
              <th style="padding:6px 8px;border:1px solid #c7d2fe;text-align:left">Producto</th>
              ${talleHeaderCols}
              <th style="padding:6px 8px;border:1px solid #c7d2fe;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${pedidoFilas}
            <tr style="background:#dcfce7;font-weight:bold">
              <td style="padding:7px 8px;border:1px solid #86efac">TOTAL GENERAL</td>
              ${totalTalleCells}
              <td style="padding:7px 8px;border:1px solid #86efac;text-align:right;font-size:14px;color:#15803d">${totalUnidades}</td>
            </tr>
          </tbody>
        </table>

        <h3>Lista de entrega por beneficiario</h3>
        <table>
          <thead>
            <tr>
              <th>#</th><th>Producto</th><th>Talle</th><th>Cant.</th><th>Precio unit.</th><th>Total</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${entregaFilas}
            <tr style="background:#dcfce7;font-weight:bold">
              <td colspan="3" style="padding:7px 8px;border:1px solid #86efac">TOTAL GENERAL</td>
              <td style="padding:7px 8px;border:1px solid #86efac;text-align:center">${totalUnidades}</td>
              <td style="padding:7px 8px;border:1px solid #86efac"></td>
              <td style="padding:7px 8px;border:1px solid #86efac;text-align:right;color:#15803d">${formatMoney(totalMonto)}</td>
              <td style="padding:7px 8px;border:1px solid #86efac"></td>
            </tr>
          </tbody>
        </table>
      </body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_encargos_tienda.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Imprimir ----
  const handlePrint = () => {
    const contenido = printRef.current.innerHTML;
    const ventana = window.open('', '_blank');
    ventana.document.write(`
      <html>
      <head>
        <title>Reporte de Pre-encargos — Tienda</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
          h1 { font-size: 17px; margin-bottom: 2px; }
          h2 { font-size: 14px; margin: 18px 0 4px; color: #312e81; }
          .sub { color: #666; font-size: 11px; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th { background: #f3f4f6; text-align: left; padding: 6px 8px; border: 1px solid #ddd; font-size: 10px; text-transform: uppercase; }
          td { padding: 5px 8px; border: 1px solid #ddd; font-size: 11px; vertical-align: top; }
          .ben-row td { background: #f0f4ff !important; font-weight: bold; border-top: 1px solid #c7d2fe; }
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

  const { map: pedido, talles } = pedidoProveedor;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Reporte de pre-encargos
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex gap-1 flex-wrap">
            {[
              { key: 'activos', label: 'Activos' },
              { key: 'Pendiente', label: 'Pendientes' },
              { key: 'Confirmado', label: 'Confirmados' },
              { key: 'Entregado', label: 'Entregados' },
              { key: 'todos', label: 'Todos' },
            ].map(f => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium border transition-all ${
                  filtro === f.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleExportXLS}>
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" />PDF
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mb-3">
          {encargosFiltrados.length} encargo(s) · <strong>{totalUnidades}</strong> unidades · <strong>{formatMoney(totalMonto)}</strong>
        </div>

        <div ref={printRef} className="space-y-6">
          {/* Pedido al proveedor */}
          <div>
            <h2 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
              <Package className="w-4 h-4" /> Pedido al proveedor
            </h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-2 py-1.5 text-left border-b">Producto</th>
                    {talles.map(t => (
                      <th key={t} className="px-2 py-1.5 text-center border-b">{t === '_sin_talle_' ? 'S/T' : t}</th>
                    ))}
                    <th className="px-2 py-1.5 text-right border-b">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(pedido).sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([nombre, data]) => (
                    <tr key={nombre} className="border-b hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-medium">{nombre}</td>
                      {talles.map(t => {
                        const val = data.talles[t] || 0;
                        return (
                          <td key={t} className={`px-2 py-1.5 text-center ${val > 0 ? 'font-bold' : 'text-muted-foreground/30'}`}>
                            {val > 0 ? val : '·'}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-right font-bold text-green-700">{data.total}</td>
                    </tr>
                  ))}
                  {Object.keys(pedido).length === 0 && (
                    <tr><td colSpan={talles.length + 2} className="text-center py-6 text-muted-foreground">No hay encargos para este filtro</td></tr>
                  )}
                </tbody>
                {Object.keys(pedido).length > 0 && (
                  <tfoot>
                    <tr className="bg-green-50 font-bold border-t-2 border-green-300">
                      <td className="px-2 py-1.5">TOTAL GENERAL</td>
                      {talles.map(t => {
                        const sum = Object.values(pedido).reduce((s, p) => s + (p.talles[t] || 0), 0);
                        return <td key={t} className="px-2 py-1.5 text-center">{sum}</td>;
                      })}
                      <td className="px-2 py-1.5 text-right text-green-700 text-sm">{totalUnidades}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Lista de entrega */}
          <div>
            <h2 className="text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Lista de entrega por beneficiario
            </h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-2 py-1.5 text-left border-b">Beneficiario</th>
                    <th className="px-2 py-1.5 text-left border-b">Producto</th>
                    <th className="px-2 py-1.5 text-center border-b">Talle</th>
                    <th className="px-2 py-1.5 text-center border-b">Cant.</th>
                    <th className="px-2 py-1.5 text-right border-b">Total</th>
                    <th className="px-2 py-1.5 text-center border-b">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {listaEntrega.map(({ nombre, items }) => (
                    <React.Fragment key={nombre}>
                      {items.map((i, idx) => (
                        <tr key={i.id} className={idx === 0 ? 'border-b bg-blue-50/40' : 'border-b'}>
                          {idx === 0 && (
                            <td rowSpan={items.length} className="px-2 py-1.5 font-semibold align-top border-r border-blue-100">
                              {nombre}
                            </td>
                          )}
                          <td className="px-2 py-1.5">{i.producto_nombre}</td>
                          <td className="px-2 py-1.5 text-center">{i.talle ? <Badge variant="outline" className="text-xs">{i.talle}</Badge> : '—'}</td>
                          <td className="px-2 py-1.5 text-center font-medium">{i.cantidad}</td>
                          <td className="px-2 py-1.5 text-right font-semibold">{formatMoney(i.monto_total)}</td>
                          <td className="px-2 py-1.5 text-center">
                            {i.estado === 'Pendiente' && <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">Pend.</Badge>}
                            {i.estado === 'Confirmado' && <Badge className="bg-blue-100 text-blue-700 border-blue-300 border text-xs">Conf.</Badge>}
                            {i.estado === 'Entregado' && <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">Entr.</Badge>}
                            {i.estado === 'Cancelado' && <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">Canc.</Badge>}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  {listaEntrega.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No hay encargos para este filtro</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}