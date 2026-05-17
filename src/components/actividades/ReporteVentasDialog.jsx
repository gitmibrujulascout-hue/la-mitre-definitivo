import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, PackageCheck, Package } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';

export default function ReporteVentasDialog({ open, onClose, actividad, ventas }) {
  const printRef = useRef();

  const totalRecaudado = ventas.reduce((s, v) => s + (v.monto_recaudado || 0), 0);
  const totalUnidades = ventas.reduce((s, v) => s + (v.cantidad_vendida || 0), 0);
  const entregadas = ventas.filter(v => v.entregado).length;
  const pendientes = ventas.filter(v => !v.entregado).length;

  const handlePrint = () => {
    const contenido = printRef.current.innerHTML;
    const ventana = window.open('', '_blank');
    ventana.document.write(`
      <html>
      <head>
        <title>Reporte de Ventas — ${actividad.nombre}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #111; }
          h1 { font-size: 18px; margin-bottom: 2px; }
          .sub { color: #666; font-size: 12px; margin-bottom: 16px; }
          .resumen { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
          .resumen-item { border: 1px solid #ddd; border-radius: 6px; padding: 8px 14px; min-width: 100px; }
          .resumen-item .label { font-size: 10px; color: #888; }
          .resumen-item .valor { font-size: 16px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #f3f4f6; text-align: left; padding: 7px 10px; border-bottom: 2px solid #ccc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; }
          td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
          tr:nth-child(even) td { background: #f9f9f9; }
          .estado-entregado { color: #16a34a; font-weight: 600; }
          .estado-pendiente { color: #b45309; font-weight: 600; }
          .retira { color: #555; font-style: italic; }
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reporte de ventas</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-2">
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
            {actividad.precio_venta_unitario > 0 && ` · Precio unitario: ${formatMoney(actividad.precio_venta_unitario)}`}
          </p>

          {/* Resumen */}
          <div className="resumen flex gap-3 flex-wrap mb-6">
            <div className="resumen-item border rounded-lg px-4 py-2 text-center">
              <div className="label text-xs text-muted-foreground">Total ventas</div>
              <div className="valor text-lg font-bold text-green-600">{ventas.length}</div>
            </div>
            <div className="resumen-item border rounded-lg px-4 py-2 text-center">
              <div className="label text-xs text-muted-foreground">Unidades</div>
              <div className="valor text-lg font-bold">{totalUnidades || '—'}</div>
            </div>
            <div className="resumen-item border rounded-lg px-4 py-2 text-center">
              <div className="label text-xs text-muted-foreground">Recaudado</div>
              <div className="valor text-lg font-bold text-green-700">{formatMoney(totalRecaudado)}</div>
            </div>
            <div className="resumen-item border rounded-lg px-4 py-2 text-center">
              <div className="label text-xs text-muted-foreground">Entregados</div>
              <div className="valor text-lg font-bold text-green-600">{entregadas}</div>
            </div>
            <div className="resumen-item border rounded-lg px-4 py-2 text-center">
              <div className="label text-xs text-muted-foreground">Pendientes</div>
              <div className="valor text-lg font-bold text-amber-600">{pendientes}</div>
            </div>
          </div>

          {/* Tabla de ventas — cada registro por separado */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/60">
                <th className="text-left p-2 font-semibold text-xs uppercase text-muted-foreground border-b-2 border-border">#</th>
                <th className="text-left p-2 font-semibold text-xs uppercase text-muted-foreground border-b-2 border-border">Vendedor</th>
                <th className="text-left p-2 font-semibold text-xs uppercase text-muted-foreground border-b-2 border-border">Producto</th>
                <th className="text-left p-2 font-semibold text-xs uppercase text-muted-foreground border-b-2 border-border">Quien retira</th>
                <th className="text-center p-2 font-semibold text-xs uppercase text-muted-foreground border-b-2 border-border">Cant.</th>
                <th className="text-right p-2 font-semibold text-xs uppercase text-muted-foreground border-b-2 border-border">Monto</th>
                <th className="text-center p-2 font-semibold text-xs uppercase text-muted-foreground border-b-2 border-border">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v, i) => (
                <tr key={v.id} className={`border-b ${v.entregado ? 'opacity-70' : ''} ${i % 2 === 1 ? 'bg-muted/20' : ''}`}>
                  <td className="p-2 text-muted-foreground text-xs">{i + 1}</td>
                  <td className="p-2 font-medium">{v.beneficiario_nombre}</td>
                  <td className="p-2 text-xs">
                    {v.producto_nombre
                      ? <span className="font-medium text-primary/80">{v.producto_nombre}{v.es_promo ? ` (promo ${v.cantidad_promo}x)` : ''}</span>
                      : <span className="text-muted-foreground italic">—</span>
                    }
                  </td>
                  <td className="p-2">
                    {v.comprador_nombre
                      ? <span className="retira text-amber-700 font-medium">🛍️ {v.comprador_nombre}</span>
                      : <span className="text-muted-foreground text-xs italic">—</span>
                    }
                  </td>
                  <td className="p-2 text-center">
                    {v.cantidad_vendida > 0
                      ? <span>{v.cantidad_vendida}{v.es_promo ? <span className="text-xs text-muted-foreground ml-0.5">p</span> : ''}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-2 text-right font-semibold text-green-600">{formatMoney(v.monto_recaudado || 0)}</td>
                  <td className="p-2 text-center">
                    {v.entregado ? (
                      <span className="estado-entregado inline-flex items-center gap-1 text-green-700 text-xs font-semibold">
                        <PackageCheck className="w-3.5 h-3.5" />
                        Entregado{v.fecha_entrega ? ` (${v.fecha_entrega})` : ''}
                      </span>
                    ) : (
                      <span className="estado-pendiente inline-flex items-center gap-1 text-amber-700 text-xs font-semibold">
                        <Package className="w-3.5 h-3.5" />
                        Pendiente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {/* Fila total */}
              <tr className="bg-green-50 border-t-2 border-green-300 font-bold">
                <td colSpan={4} className="p-2 text-sm font-bold">TOTAL</td>
                <td className="p-2 text-center font-bold">{totalUnidades || '—'}</td>
                <td className="p-2 text-right font-bold text-green-700 text-base">{formatMoney(totalRecaudado)}</td>
                <td className="p-2 text-center text-xs text-muted-foreground">
                  {entregadas} ✓ / {pendientes} ⏳
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