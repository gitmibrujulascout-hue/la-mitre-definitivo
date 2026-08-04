import React, { useMemo, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Printer, Users } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { filtrarEncargos, buildListaEntrega } from '@/lib/reporteEncargosUtils';

const FILTROS = [
  { key: 'activos', label: 'Activos' },
  { key: 'Pendiente', label: 'Pendientes' },
  { key: 'Confirmado', label: 'Confirmados' },
  { key: 'Entregado', label: 'Entregados' },
  { key: 'todos', label: 'Todos' },
];

function estadoBadge(estado) {
  if (estado === 'Pendiente') return <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">Pend.</Badge>;
  if (estado === 'Confirmado') return <Badge className="bg-blue-100 text-blue-700 border-blue-300 border text-xs">Conf.</Badge>;
  if (estado === 'Entregado') return <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">Entr.</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">Canc.</Badge>;
}

export default function ListaEntregaDialog({ encargos, onClose }) {
  const [filtro, setFiltro] = useState('activos');
  const printRef = useRef();

  const encargosFiltrados = useMemo(() => filtrarEncargos(encargos, filtro), [encargos, filtro]);
  const listaEntrega = useMemo(() => buildListaEntrega(encargosFiltrados), [encargosFiltrados]);
  const totalUnidades = encargosFiltrados.reduce((s, e) => s + (e.cantidad || 0), 0);
  const totalMonto = encargosFiltrados.reduce((s, e) => s + (e.monto_total || 0), 0);

  const handleExportXLS = () => {
    let rn = 0;
    const filas = listaEntrega.map(({ nombre, items }) => {
      const subTotal = items.reduce((s, i) => s + (i.monto_total || 0), 0);
      const subUnidades = items.reduce((s, i) => s + (i.cantidad || 0), 0);
      const benHeader = `<tr style="background:#e8eeff"><td colspan="4" style="padding:6px 8px;border:1px solid #b0b8e0;font-weight:bold;color:#2a3d9e">${nombre}</td><td style="padding:6px 8px;border:1px solid #b0b8e0;text-align:center;font-weight:bold">${subUnidades}</td><td style="padding:6px 8px;border:1px solid #b0b8e0;text-align:right;font-weight:bold;color:#15803d">${formatMoney(subTotal)}</td><td style="padding:6px 8px;border:1px solid #b0b8e0;text-align:center">${items[0]?.estado || ''}</td></tr>`;
      const itemFilas = items.map(i => {
        rn++;
        return `<tr><td style="padding:5px 8px;border:1px solid #ddd;color:#888">${rn}</td><td style="padding:5px 8px 5px 20px;border:1px solid #ddd">${i.producto_nombre}</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${i.talle || '—'}</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${i.cantidad || 0}</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:right">${formatMoney(i.precio_unitario || 0)}</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;font-weight:bold">${formatMoney(i.monto_total || 0)}</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${i.estado}</td></tr>`;
      }).join('');
      return benHeader + itemFilas;
    }).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}th{background:#f3f4f6;padding:7px 8px;border:1px solid #ccc;font-size:10px;text-transform:uppercase;text-align:left}h2{font-size:15px;color:#312e81}</style></head><body>
      <h2>Lista de entrega por beneficiario — Tienda</h2>
      <p style="font-size:11px;color:#666">Filtro: ${filtro} · ${encargosFiltrados.length} encargo(s) · ${totalUnidades} unidades · ${formatMoney(totalMonto)}</p>
      <table><thead><tr><th>#</th><th>Producto</th><th>Talle</th><th>Cant.</th><th>Precio unit.</th><th>Total</th><th>Estado</th></tr></thead><tbody>${filas}<tr style="background:#dcfce7;font-weight:bold"><td colspan="3" style="padding:7px 8px;border:1px solid #86efac">TOTAL GENERAL</td><td style="padding:7px 8px;border:1px solid #86efac;text-align:center">${totalUnidades}</td><td style="padding:7px 8px;border:1px solid #86efac"></td><td style="padding:7px 8px;border:1px solid #86efac;text-align:right;color:#15803d">${formatMoney(totalMonto)}</td><td style="padding:7px 8px;border:1px solid #86efac"></td></tr></tbody></table>
    </body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lista_entrega_tienda.xls';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const contenido = printRef.current.innerHTML;
    const v = window.open('', '_blank');
    v.document.write(`<html><head><title>Lista de entrega</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}h1{font-size:17px;margin-bottom:2px}.sub{color:#666;font-size:11px;margin-bottom:14px}table{width:100%;border-collapse:collapse;margin-top:6px}th{background:#f3f4f6;text-align:left;padding:6px 8px;border:1px solid #ddd;font-size:10px;text-transform:uppercase}td{padding:5px 8px;border:1px solid #ddd;font-size:11px;vertical-align:top}.ben-row td{background:#f0f4ff!important;font-weight:bold;border-top:1px solid #c7d2fe}.total-row td{background:#dcfce7!important;font-weight:bold;border-top:2px solid #86efac}@media print{button{display:none!important}}</style></head><body>${contenido}</body></html>`);
    v.document.close();
    v.focus();
    v.print();
    v.close();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Lista de entrega (uso interno)
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
          {encargosFiltrados.length} encargo(s) · <strong>{totalUnidades}</strong> unidades · <strong>{formatMoney(totalMonto)}</strong>
        </div>

        <div ref={printRef} className="space-y-4">
          {listaEntrega.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No hay encargos para este filtro</p>
          ) : listaEntrega.map(({ nombre, items }) => {
            const subUnidades = items.reduce((s, i) => s + (i.cantidad || 0), 0);
            const subTotal = items.reduce((s, i) => s + (i.monto_total || 0), 0);
            return (
              <div key={nombre} className="border rounded-lg overflow-hidden">
                <div className="bg-blue-50/60 px-3 py-2 flex items-center justify-between border-b border-blue-100">
                  <span className="font-semibold text-sm text-blue-900">{nombre}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{subUnidades} {subUnidades === 1 ? 'unidad' : 'unidades'}</span>
                    <span className="font-bold text-green-700">{formatMoney(subTotal)}</span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="px-2 py-1.5 text-left border-b">Producto</th>
                      <th className="px-2 py-1.5 text-center border-b">Talle</th>
                      <th className="px-2 py-1.5 text-center border-b">Cant.</th>
                      <th className="px-2 py-1.5 text-right border-b">Total</th>
                      <th className="px-2 py-1.5 text-center border-b">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(i => (
                      <tr key={i.id} className="border-b">
                        <td className="px-2 py-1.5">{i.producto_nombre}</td>
                        <td className="px-2 py-1.5 text-center">{i.talle ? <Badge variant="outline" className="text-xs">{i.talle}</Badge> : '—'}</td>
                        <td className="px-2 py-1.5 text-center font-medium">{i.cantidad}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{formatMoney(i.monto_total)}</td>
                        <td className="px-2 py-1.5 text-center">{estadoBadge(i.estado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {listaEntrega.length > 0 && (
            <div className="bg-green-50 border-t-2 border-green-300 px-3 py-2 flex items-center justify-between text-sm font-bold rounded">
              <span>TOTAL GENERAL</span>
              <span className="text-green-700">{totalUnidades} unidades · {formatMoney(totalMonto)}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}