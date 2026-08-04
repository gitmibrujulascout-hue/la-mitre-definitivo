import React, { useMemo, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Printer, Package } from 'lucide-react';
import { filtrarEncargos, buildPedidoProveedor } from '@/lib/reporteEncargosUtils';

const FILTROS = [
  { key: 'activos', label: 'Activos' },
  { key: 'Pendiente', label: 'Pendientes' },
  { key: 'Confirmado', label: 'Confirmados' },
  { key: 'Entregado', label: 'Entregados' },
  { key: 'todos', label: 'Todos' },
];

export default function ReporteProveedorDialog({ encargos, onClose }) {
  const [filtro, setFiltro] = useState('activos');
  const printRef = useRef();

  const encargosFiltrados = useMemo(() => filtrarEncargos(encargos, filtro), [encargos, filtro]);
  const { map: pedido, talles } = useMemo(() => buildPedidoProveedor(encargosFiltrados), [encargosFiltrados]);
  const totalUnidades = encargosFiltrados.reduce((s, e) => s + (e.cantidad || 0), 0);
  const productosOrdenados = Object.entries(pedido).sort((a, b) => a[0].localeCompare(b[0], 'es'));

  const handleExportXLS = () => {
    const talleHeaderCols = talles.map(t =>
      `<th style="padding:6px 8px;border:1px solid #c7d2fe;text-align:center">${t === '_sin_talle_' ? 'Sin talle' : t}</th>`
    ).join('');
    const filas = productosOrdenados.map(([nombre, data]) => {
      const talleCells = talles.map(t => {
        const val = data.talles[t] || 0;
        return `<td style="padding:5px 8px;border:1px solid #ddd;text-align:center${val > 0 ? ';font-weight:bold' : ';color:#ccc'}">${val > 0 ? val : ''}</td>`;
      }).join('');
      return `<tr><td style="padding:5px 8px;border:1px solid #ddd;font-weight:bold">${nombre}</td>${talleCells}<td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;color:#15803d">${data.total}</td></tr>`;
    }).join('');
    const totalTalleCells = talles.map(t => {
      const sum = Object.values(pedido).reduce((s, p) => s + (p.talles[t] || 0), 0);
      return `<td style="padding:7px 8px;border:1px solid #86efac;text-align:center;font-weight:bold">${sum}</td>`;
    }).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}th{background:#f3f4f6;padding:7px 8px;border:1px solid #ccc;font-size:10px;text-transform:uppercase;text-align:left}h2{font-size:15px;color:#312e81}</style></head><body>
      <h2>Pedido al proveedor — Tienda Scout Bartolomé Mitre</h2>
      <p style="font-size:11px;color:#666">Filtro: ${filtro} · ${encargosFiltrados.length} encargo(s) · ${totalUnidades} unidades</p>
      <table><thead><tr style="background:#e0e7ff"><th style="padding:6px 8px;border:1px solid #c7d2fe;text-align:left">Producto</th>${talleHeaderCols}<th style="padding:6px 8px;border:1px solid #c7d2fe;text-align:right">Total</th></tr></thead><tbody>${filas}<tr style="background:#dcfce7;font-weight:bold"><td style="padding:7px 8px;border:1px solid #86efac">TOTAL GENERAL</td>${totalTalleCells}<td style="padding:7px 8px;border:1px solid #86efac;text-align:right;font-size:14px;color:#15803d">${totalUnidades}</td></tr></tbody></table>
    </body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pedido_proveedor_tienda.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const contenido = printRef.current.innerHTML;
    const v = window.open('', '_blank');
    v.document.write(`<html><head><title>Pedido al proveedor</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}h1{font-size:17px;margin-bottom:2px}.sub{color:#666;font-size:11px;margin-bottom:14px}table{width:100%;border-collapse:collapse;margin-top:6px}th{background:#f3f4f6;text-align:left;padding:6px 8px;border:1px solid #ddd;font-size:10px;text-transform:uppercase}td{padding:5px 8px;border:1px solid #ddd;font-size:11px}.total-row td{background:#dcfce7!important;font-weight:bold;border-top:2px solid #86efac}@media print{button{display:none!important}}</style></head><body>${contenido}</body></html>`);
    v.document.close();
    v.focus();
    v.print();
    v.close();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Pedido al proveedor
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex gap-1 flex-wrap">
            {FILTROS.map(f => (
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
          {encargosFiltrados.length} encargo(s) · <strong>{totalUnidades}</strong> unidades
        </div>

        <div ref={printRef}>
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
                {productosOrdenados.map(([nombre, data]) => (
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
                {productosOrdenados.length === 0 && (
                  <tr><td colSpan={talles.length + 2} className="text-center py-6 text-muted-foreground">No hay encargos para este filtro</td></tr>
                )}
              </tbody>
              {productosOrdenados.length > 0 && (
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
      </DialogContent>
    </Dialog>
  );
}