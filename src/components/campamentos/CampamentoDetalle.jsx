import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Pencil, Printer, MapPin, Calendar, Users } from 'lucide-react';
import RamaBadge from '@/components/shared/RamaBadge';
import { formatMoney, RAMA_CONFIG, RAMAS } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';
import AutorizacionesPanel from './AutorizacionesPanel';
import BalanceCampamento from './BalanceCampamento';
import { differenceInYears, parseISO } from 'date-fns';

// Orden canónico de ramas
const ORDEN_RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers'];

export default function CampamentoDetalle({ campamento, beneficiarios, pagos, gastos, onBack, onEdit }) {
  const getBen = (id) => beneficiarios.find(b => b.id === id);

  const menoresCount = useMemo(() =>
    (campamento.beneficiarios_ids || [])
      .map(getBen).filter(Boolean)
      .filter(b => {
        if (!b.fecha_nacimiento) return true;
        return differenceInYears(new Date(), parseISO(b.fecha_nacimiento)) < 18;
      }).length,
    [campamento, beneficiarios]
  );
  const autorizacionesCount = (campamento.autorizaciones_ids || []).length;

  const ninos = useMemo(() =>
    (campamento.beneficiarios_ids || []).map(getBen).filter(Boolean),
    [campamento, beneficiarios]
  );
  const adultos = useMemo(() =>
    (campamento.adultos_ids || []).map(getBen).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [campamento, beneficiarios]
  );

  // Niños agrupados por rama, en orden canónico, y dentro de cada rama alfabéticamente
  const ninosPorRama = useMemo(() => {
    const map = {};
    for (const b of ninos) {
      const r = b.rama || 'Sin rama';
      if (!map[r]) map[r] = [];
      map[r].push(b);
    }
    // Ordenar dentro de cada rama alfabéticamente
    for (const r of Object.keys(map)) {
      map[r].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    // Devolver en orden canónico, luego cualquier otra
    const ordenadas = ORDEN_RAMAS.filter(r => map[r]).map(r => [r, map[r]]);
    const otras = Object.entries(map).filter(([r]) => !ORDEN_RAMAS.includes(r));
    return [...ordenadas, ...otras];
  }, [ninos]);

  const resumenRamas = ninosPorRama.map(([rama, lista]) => [rama, lista.length]);
  const total = ninos.length + adultos.length;

  const handlePrint = () => {
    const autorizadosSet = new Set(campamento.autorizaciones_ids || []);
    // Mapa beneficiario_id -> monto pagado para este campamento
    const pagosMap = {};
    (pagos || []).forEach(p => {
      if (p.tipo_pago === 'Campamento' && p.campamento_id === campamento.id) {
        pagosMap[p.beneficiario_id] = (pagosMap[p.beneficiario_id] || 0) + (p.monto || 0);
      }
    });

    let contador = 0;
    const ramasHtml = ninosPorRama.map(([rama, lista]) => {
      const rows = lista.map(b => {
        contador++;
        const autorizo = autorizadosSet.has(b.id) ? '✓' : '';
        const montoPagado = pagosMap[b.id] ? `$${pagosMap[b.id].toLocaleString('es-AR')}` : '';
        const autorizClass = autorizadosSet.has(b.id) ? 'style="color:green;font-weight:bold;text-align:center"' : 'style="text-align:center"';
        const pagoClass = pagosMap[b.id] ? 'style="color:green;font-weight:bold;text-align:center"' : 'style="text-align:center"';
        return `<tr>
          <td>${contador}</td>
          <td>${b.nombre}</td>
          <td>${b.dni || ''}</td>
          <td ${autorizClass}>${autorizo}</td>
          <td ${pagoClass}>${montoPagado}</td>
        </tr>`;
      }).join('');
      return `
        <div class="rama-titulo" style="background:${rama === 'Lobatos' ? '#fef9c3' : rama === 'Tropa' ? '#dcfce7' : rama === 'KM' ? '#dbeafe' : rama === 'Rovers' ? '#fee2e2' : '#f1f5f9'}">
          ${rama} (${lista.length})
        </div>
        <table>
          <thead><tr><th>#</th><th>Nombre</th><th>DNI</th><th style="text-align:center;width:80px">Autorización</th><th style="text-align:center;width:90px">Pago</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }).join('<div style="margin-top:16px"></div>');

    const adultosRows = adultos.map((b, i) =>
      `<tr><td>${i + 1}</td><td>${b.nombre}</td><td>${b.funcion || b.rama_educador || b.rama || ''}</td><td>${b.dni || ''}</td><td>${campamento.adultos_pagan ? '' : 'No abona'}</td></tr>`
    ).join('');

    const resumenTexto = resumenRamas.map(([r, c]) => `${r}: ${c}`).join(' | ');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Listado ${campamento.nombre}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:13px}
      h1{margin-bottom:4px;font-size:18px}
      .meta{color:#555;margin-bottom:16px;font-size:11px}
      table{width:100%;border-collapse:collapse;margin-top:6px;margin-bottom:4px}
      th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}
      th{background:#f0f0f0;font-weight:bold;font-size:12px}
      td{font-size:12px}
      .rama-titulo{font-weight:bold;font-size:13px;padding:6px 10px;border-radius:4px;margin-top:16px;border:1px solid #ccc}
      .seccion{margin-top:20px;font-weight:bold;font-size:14px;border-bottom:2px solid #333;padding-bottom:4px}
      .resumen{margin-top:20px;padding:10px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:12px}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${campamento.nombre}</h1>
    <div class="meta">
      ${campamento.ubicacion ? `📍 ${campamento.ubicacion} &nbsp;` : ''}
      ${campamento.fecha_inicio ? `📅 ${campamento.fecha_inicio}${campamento.fecha_fin ? ` al ${campamento.fecha_fin}` : ''}` : ''}
      &nbsp;|&nbsp; Costo niños: ${formatMoney(campamento.costo_por_persona)}
      ${campamento.adultos_pagan && campamento.costo_adultos ? ` | Costo adultos: ${formatMoney(campamento.costo_adultos)}` : ''}
    </div>
    ${ninos.length > 0 ? `<div class="seccion">Niños / Beneficiarios (${ninos.length})</div>${ramasHtml}` : ''}
    ${adultos.length > 0 ? `
      <div class="seccion" style="margin-top:24px">Adultos / Voluntarios (${adultos.length})</div>
      <table><thead><tr><th>#</th><th>Nombre</th><th>Rol / Rama</th><th>DNI</th><th>Pago</th></tr></thead>
      <tbody>${adultosRows}</tbody></table>` : ''}
    <div class="resumen">
      <strong>Resumen:</strong> ${resumenTexto}${adultos.length > 0 ? ` | Adultos: ${adultos.length}` : ''} | <strong>TOTAL: ${total} personas</strong>
    </div>
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="text-2xl font-bold">{campamento.nombre}</h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
              {campamento.ubicacion && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{campamento.ubicacion}</span>}
              {campamento.fecha_inicio && <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{campamento.fecha_inicio}{campamento.fecha_fin ? ` — ${campamento.fecha_fin}` : ''}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" />Exportar listado</Button>
          <Button onClick={onEdit}><Pencil className="w-4 h-4 mr-2" />Editar</Button>
        </div>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{ninos.length}</p>
          <p className="text-xs text-muted-foreground">Niños</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{adultos.length}</p>
          <p className="text-xs text-muted-foreground">Adultos</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{total}</p>
          <p className="text-xs text-muted-foreground">Total personas</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{formatMoney(campamento.costo_por_persona)}</p>
          <p className="text-xs text-muted-foreground">Costo/niño</p>
        </Card>
        <Card className="p-4 text-center">
          <p className={cn('text-2xl font-bold', autorizacionesCount === menoresCount && menoresCount > 0 ? 'text-green-600' : 'text-amber-500')}>
            {autorizacionesCount}/{menoresCount}
          </p>
          <p className="text-xs text-muted-foreground">Autorizaciones</p>
        </Card>
      </div>

      {/* Ramas badges */}
      {campamento.ramas_participantes?.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {campamento.ramas_participantes.map(r => <RamaBadge key={r} rama={r} />)}
          {campamento.adultos_pagan && (
            <Badge variant="outline" className="text-xs">Adultos abonan {campamento.costo_adultos ? formatMoney(campamento.costo_adultos) : ''}</Badge>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AutorizacionesPanel campamento={campamento} beneficiarios={beneficiarios} />
        <BalanceCampamento campamento={campamento} pagos={pagos} gastos={gastos} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Niños agrupados por rama */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />Niños / Beneficiarios ({ninos.length})
            </CardTitle>
            {/* Resumen por rama */}
            {resumenRamas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {resumenRamas.map(([rama, cant]) => {
                  const config = RAMA_CONFIG[rama];
                  return (
                    <span key={rama} className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', config?.badge)}>
                      {rama}: {cant}
                    </span>
                  );
                })}
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0 max-h-96 overflow-y-auto">
            {ninos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin niños asignados</p>
            ) : ninosPorRama.map(([rama, lista]) => {
              const config = RAMA_CONFIG[rama];
              return (
                <div key={rama} className="mb-4 last:mb-0">
                  <div className={cn('flex items-center gap-2 px-2 py-1 rounded-md mb-1', config?.badge || 'bg-muted')}>
                    <span className={cn('w-2 h-2 rounded-full', config?.dot || 'bg-muted-foreground')} />
                    <span className="text-xs font-bold uppercase tracking-wide">{rama} ({lista.length})</span>
                  </div>
                  {lista.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-2 py-1 px-3 text-sm hover:bg-muted/40 rounded">
                      <span className="text-muted-foreground w-5 text-xs">{i + 1}.</span>
                      <span className="flex-1">{b.nombre}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Adultos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />Adultos / Voluntarios ({adultos.length})
              {campamento.adultos_pagan && <Badge className="ml-1 text-xs">Abonan</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 max-h-96 overflow-y-auto">
            {adultos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin adultos asignados</p>
            ) : adultos.map((b, i) => (
              <div key={b.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                <span className="text-muted-foreground w-5">{i + 1}.</span>
                <span className="flex-1">{b.nombre}</span>
                <div className="flex items-center gap-1.5">
                  {b.rama_educador && <Badge variant="outline" className="text-xs">{b.rama_educador}</Badge>}
                  <span className="text-xs text-muted-foreground">{b.funcion || ''}</span>
                  {campamento.adultos_pagan
                    ? <Badge variant="outline" className="text-xs">{formatMoney(campamento.costo_adultos || campamento.costo_por_persona)}</Badge>
                    : <Badge variant="secondary" className="text-xs">No abona</Badge>
                  }
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {campamento.observaciones && (
        <Card className="mt-4 p-4">
          <p className="text-sm text-muted-foreground">{campamento.observaciones}</p>
        </Card>
      )}
    </div>
  );
}