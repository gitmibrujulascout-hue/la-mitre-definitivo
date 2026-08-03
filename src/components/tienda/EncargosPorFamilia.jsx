import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessageCircle, ChevronDown, Users, Check, CheckCheck, Phone, Pencil, DollarSign } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { openWhatsApp } from '@/lib/whatsappWindow';
import { cn } from '@/lib/utils';

/**
 * Muestra los pre-encargos agrupados por familia (grupo_familiar),
 * con un botón de WhatsApp para enviar el pedido completo y solicitar confirmación.
 * Los encargos Cancelados se excluyen del mensaje y del total.
 */
export default function EncargosPorFamilia({ encargos, beneficiarios, productos, onConfirmarFamilia, onEditarEncargo, onRegistrarPago }) {
  // Mapa de beneficiario_id → beneficiario
  const benMap = useMemo(() => {
    const m = {};
    beneficiarios.forEach(b => { m[b.id] = b; });
    return m;
  }, [beneficiarios]);

  // Agrupar encargos por familia
  const familias = useMemo(() => {
    const grupos = {};
    encargos.forEach(e => {
      const ben = benMap[e.beneficiario_id];
      const gf = ben?.grupo_familiar || e.beneficiario_nombre || e.beneficiario_id;
      if (!grupos[gf]) {
        grupos[gf] = {
          key: gf,
          label: ben?.grupo_familiar || e.beneficiario_nombre,
          items: [],
          telefonos: {},
        };
      }
      grupos[gf].items.push(e);
      // Recolectar teléfonos de todos los miembros de la familia
      if (ben) {
        if (ben.telefono_contacto) grupos[gf].telefonos[ben.telefono_contacto] = ben.nombre;
        if (ben.telefono_contacto_2) grupos[gf].telefonos[ben.telefono_contacto_2] = ben.nombre;
      }
    });

    // Familias con al menos un encargo Pendiente (pendientes de confirmación)
    return Object.values(grupos)
      .filter(g => g.items.some(i => i.estado === 'Pendiente'))
      .sort((a, b) => b.items.length - a.items.length);
  }, [encargos, benMap]);

  if (familias.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No hay pedidos pendientes de confirmación o pago.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {familias.map(fam => {
        // Solo mostrar pendientes (los confirmados ya no aparecen aquí)
        const pendientes = fam.items.filter(i => i.estado === 'Pendiente');
        const itemsActivos = pendientes;
        const total = pendientes.reduce((s, i) => s + (i.monto_total || 0), 0);
        const totalPagado = pendientes.reduce((s, i) => s + (i.monto_pagado || 0), 0);
        const saldoFamilia = total - totalPagado;
        const tels = Object.entries(fam.telefonos); // [[telefono, nombre], ...]

        return (
          <Card key={fam.key} className="border-amber-200">
            <CardContent className="p-4">
              {/* Header familia */}
              <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">{fam.label}</h4>
                    <p className="text-xs text-muted-foreground">
                      {pendientes.length} pendiente(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* WhatsApp */}
                  <WhatsAppFamiliaBtn telefonos={tels} fam={fam} />
                  {/* Confirmar todos los pendientes (solo si hay) */}
                  {pendientes.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-700 border-green-300 hover:bg-green-50 h-8"
                      onClick={() => onConfirmarFamilia(pendientes.map(p => p.id))}
                    >
                      <CheckCheck className="w-3.5 h-3.5 mr-1" />
                      Confirmar todos
                    </Button>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {itemsActivos.map(item => {
                  const pagado = item.monto_pagado || 0;
                  const saldo = Math.max(0, (item.monto_total || 0) - pagado);
                  const tienePago = pagado > 0;
                  const pagoCompleto = saldo === 0 && (item.monto_total || 0) > 0;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded-md group',
                        item.estado === 'Pendiente' ? 'bg-amber-50' : 'bg-transparent'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.estado === 'Pendiente' ? (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        )}
                        <span className="font-medium truncate">{item.producto_nombre}</span>
                        {item.talle && <Badge variant="outline" className="text-xs shrink-0">{item.talle}</Badge>}
                        <span className="text-muted-foreground text-xs">· {item.cantidad} u.</span>
                        {tienePago && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs shrink-0',
                              pagoCompleto
                                ? 'border-green-400 text-green-700 bg-green-50'
                                : 'border-blue-400 text-blue-700 bg-blue-50'
                            )}
                          >
                            {pagoCompleto ? 'Pagado' : 'Seña'}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          {tienePago ? (
                            <>
                              <span className="font-semibold text-green-700">{formatMoney(item.monto_total)}</span>
                              {saldo > 0 && (
                                <p className="text-xs text-blue-600">Saldo: {formatMoney(saldo)}</p>
                              )}
                            </>
                          ) : (
                            <span className="font-semibold text-green-700">{formatMoney(item.monto_total)}</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Registrar pago"
                          onClick={() => onRegistrarPago(item)}
                        >
                          <DollarSign className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Editar encargo"
                          onClick={() => onEditarEncargo(item)}
                        >
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t">
                <div className="text-sm font-medium text-muted-foreground">
                  {totalPagado > 0 ? (
                    <span>
                      Pagado: <strong className="text-green-700">{formatMoney(totalPagado)}</strong>
                      <span className="text-muted-foreground"> · Saldo: </span>
                      <strong className="text-amber-700">{formatMoney(saldoFamilia)}</strong>
                    </span>
                  ) : (
                    'Total del pedido'
                  )}
                </div>
                <span className="text-base font-bold text-green-700">{formatMoney(total)}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// --- Botón WhatsApp por familia con selección de número ---
function WhatsAppFamiliaBtn({ telefonos, fam }) {
  if (telefonos.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled className="text-green-700 border-green-300 h-8">
        <MessageCircle className="w-3.5 h-3.5 mr-1 text-green-400" />
        Sin teléfono
      </Button>
    );
  }

  const abrir = (telefono) => {
    const limpio = limpiarTelefono(telefono);
    const mensaje = armarMensajeFamilia(fam);
    openWhatsApp(`https://web.whatsapp.com/send?phone=${limpio}&text=${encodeURIComponent(mensaje)}`);
  };

  if (telefonos.length === 1) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => abrir(telefonos[0][0])}
        className="text-green-700 border-green-300 hover:bg-green-50 h-8"
      >
        <MessageCircle className="w-3.5 h-3.5 mr-1 text-green-600" />
        WhatsApp
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50 h-8">
          <MessageCircle className="w-3.5 h-3.5 mr-1 text-green-600" />
          WhatsApp
          <ChevronDown className="w-3 h-3 ml-0.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {telefonos.map(([tel, nombreBen]) => (
          <DropdownMenuItem key={tel} onClick={() => abrir(tel)}>
            <Phone className="w-3.5 h-3.5 mr-2 text-green-600" />
            <span className="text-xs">{nombreBen}</span>
            <span className="text-xs text-muted-foreground ml-auto">{tel}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Helpers ---
function limpiarTelefono(tel) {
  if (!tel) return '';
  let limpio = tel.replace(/[\s\-().+]/g, '');
  if (limpio.startsWith('0')) limpio = '54' + limpio.slice(1);
  if (!limpio.startsWith('54') && limpio.length >= 10) limpio = '54' + limpio;
  return limpio;
}

function armarMensajeFamilia(fam) {
  // Solo incluir pendientes en el mensaje
  const items = fam.items.filter(i => i.estado === 'Pendiente');
  const total = items.reduce((s, i) => s + (i.monto_total || 0), 0);

  let lineas = '';
  items.forEach((item, idx) => {
    const talle = item.talle ? ` (talle ${item.talle})` : '';
    lineas += `${idx + 1}. ${item.producto_nombre}${talle} — ${item.cantidad} u. — ${formatMoney(item.monto_total)}\n`;
  });

  return `Hola! 👋 Les escribimos desde la Tienda del *Grupo Scout Bartolomé Mitre*.

Hemos recibido el pedido de su familia:

📋 *Pedido:*
${lineas}
💰 *Total:* ${formatMoney(total)}

Por favor, confirmen el pedido respondiendo a este mensaje.
Una vez confirmado, lo pasaremos al proveedor. 🛍️

¡Muchas gracias! 🙏`;
}