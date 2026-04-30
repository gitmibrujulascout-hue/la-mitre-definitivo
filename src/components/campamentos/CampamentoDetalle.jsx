import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Pencil, Printer, MapPin, Calendar, DollarSign, Users } from 'lucide-react';
import RamaBadge from '@/components/shared/RamaBadge';
import { formatMoney, RAMA_CONFIG } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

export default function CampamentoDetalle({ campamento, beneficiarios, pagos, onBack, onEdit }) {
  const getBen = (id) => beneficiarios.find(b => b.id === id);

  const ninos = useMemo(() =>
    (campamento.beneficiarios_ids || []).map(getBen).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [campamento, beneficiarios]
  );
  const adultos = useMemo(() =>
    (campamento.adultos_ids || []).map(getBen).filter(Boolean).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [campamento, beneficiarios]
  );

  // Resumen por rama
  const resumenRamas = useMemo(() => {
    const map = {};
    for (const b of ninos) {
      if (!b.rama) continue;
      map[b.rama] = (map[b.rama] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ninos]);

  const total = ninos.length + adultos.length;

  const handlePrint = () => {
    const ramasResumen = resumenRamas.map(([rama, cant]) => `${rama}: ${cant}`).join(' | ');
    const ninosRows = ninos.map((b, i) => `<tr><td>${i + 1}</td><td>${b.nombre}</td><td>${b.rama || ''}</td><td>${b.dni || ''}</td><td></td></tr>`).join('');
    const adultosRows = adultos.map((b, i) => `<tr><td>${ninos.length + i + 1}</td><td>${b.nombre}</td><td>Adulto${b.funcion ? ` / ${b.funcion}` : ''}</td><td>${b.dni || ''}</td><td>${campamento.adultos_pagan ? '' : 'No abona'}</td></tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Listado ${campamento.nombre}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px}h1{margin-bottom:4px}
    .meta{color:#666;margin-bottom:16px;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}
    th{background:#f0f0f0;font-weight:bold}
    .resumen{margin-top:20px;padding:12px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px}
    .resumen h3{margin:0 0 6px 0;font-size:13px}
    .seccion{margin-top:20px;font-weight:bold;color:#333;font-size:14px;border-bottom:2px solid #333;padding-bottom:4px}
    @media print{button{display:none}}</style></head><body>
    <h1>${campamento.nombre}</h1>
    <div class="meta">
      ${campamento.ubicacion ? `📍 ${campamento.ubicacion} &nbsp;` : ''}
      ${campamento.fecha_inicio ? `📅 ${campamento.fecha_inicio}${campamento.fecha_fin ? ` al ${campamento.fecha_fin}` : ''}` : ''}
      &nbsp;|&nbsp; Costo niños: ${formatMoney(campamento.costo_por_persona)}
      ${campamento.adultos_pagan && campamento.costo_adultos ? ` | Costo adultos: ${formatMoney(campamento.costo_adultos)}` : ''}
    </div>
    ${ninos.length > 0 ? `<div class="seccion">Niños / Beneficiarios (${ninos.length})</div>
    <table><thead><tr><th>#</th><th>Nombre</th><th>Rama</th><th>DNI</th><th>Pago</th></tr></thead>
    <tbody>${ninosRows}</tbody></table>` : ''}
    ${adultos.length > 0 ? `<div class="seccion">Adultos / Voluntarios (${adultos.length})</div>
    <table><thead><tr><th>#</th><th>Nombre</th><th>Rol</th><th>DNI</th><th>Pago</th></tr></thead>
    <tbody>${adultosRows}</tbody></table>` : ''}
    <div class="resumen">
      <h3>Resumen de asistencia</h3>
      <p>${ramasResumen} ${adultos.length > 0 ? `| Adultos: ${adultos.length}` : ''} | <strong>TOTAL: ${total} personas</strong></p>
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
      <div className="flex items-start justify-between mb-6">
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
      </div>

      {/* Ramas */}
      {campamento.ramas_participantes?.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {campamento.ramas_participantes.map(r => <RamaBadge key={r} rama={r} />)}
          {campamento.adultos_pagan && (
            <Badge variant="outline" className="text-xs">Adultos abonan {campamento.costo_adultos ? formatMoney(campamento.costo_adultos) : ''}</Badge>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Niños */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />Niños / Beneficiarios ({ninos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Resumen por rama */}
            {resumenRamas.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
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
            {ninos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin niños asignados</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {ninos.map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                    <span className="text-muted-foreground w-5">{i + 1}.</span>
                    <span className="flex-1">{b.nombre}</span>
                    <RamaBadge rama={b.rama} />
                  </div>
                ))}
              </div>
            )}
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
          <CardContent className="pt-0">
            {adultos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin adultos asignados</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {adultos.map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                    <span className="text-muted-foreground w-5">{i + 1}.</span>
                    <span className="flex-1">{b.nombre}</span>
                    <span className="text-xs text-muted-foreground">{b.funcion || b.rama || ''}</span>
                    {campamento.adultos_pagan
                      ? <Badge variant="outline" className="text-xs ml-2">{formatMoney(campamento.costo_adultos || campamento.costo_por_persona)}</Badge>
                      : <Badge variant="secondary" className="text-xs ml-2">No abona</Badge>
                    }
                  </div>
                ))}
              </div>
            )}
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