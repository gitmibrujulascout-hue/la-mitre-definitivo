import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MESES, MESES_SIN_CUOTA, formatMoney, marzoEsBonificado } from '@/lib/ramaUtils';

/**
 * Botón que abre web.whatsapp.com con el resumen de estado de cuenta.
 * Si hay dos teléfonos, muestra un dropdown para elegir a cuál enviar.
 */
export default function WhatsAppResumenBtn({
  beneficiario,
  pagos,
  campamentos = [],
  anio,
  afiliacion,
  esPrimeraVezAfiliacion,
  creditos = [],
}) {
  const tel1 = beneficiario.telefono_contacto;
  const tel2 = beneficiario.telefono_contacto_2;
  const hayDos = !!tel1 && !!tel2;
  const hayAlguno = !!tel1 || !!tel2;

  const abrir = (telefono) => {
    const limpio = limpiarTelefono(telefono);
    const mensaje = armarMensaje({ beneficiario, pagos, campamentos, anio, afiliacion, esPrimeraVezAfiliacion, creditos });
    window.open(`https://web.whatsapp.com/send?phone=${limpio}&text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  if (!hayAlguno) {
    return (
      <Button variant="outline" size="sm" disabled className="text-green-700 border-green-300">
        <MessageCircle className="w-4 h-4 mr-2 text-green-400" />
        Sin teléfono
      </Button>
    );
  }

  if (!hayDos) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => abrir(tel1 || tel2)}
        className="text-green-700 border-green-300 hover:bg-green-50"
      >
        <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
        Enviar por WhatsApp
      </Button>
    );
  }

  // Dos teléfonos → dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50">
          <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
          Enviar por WhatsApp
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => abrir(tel1)}>
          📱 Tel. principal: {tel1}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => abrir(tel2)}>
          📱 Tel. secundario: {tel2}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- helpers ---

function limpiarTelefono(tel) {
  if (!tel) return '';
  let limpio = tel.replace(/[\s\-().+]/g, '');
  if (limpio.startsWith('0')) limpio = '54' + limpio.slice(1);
  if (!limpio.startsWith('54') && limpio.length >= 10) limpio = '54' + limpio;
  return limpio;
}

function armarMensaje({ beneficiario, pagos, campamentos, anio, afiliacion, esPrimeraVezAfiliacion, creditos }) {
  const nombre = beneficiario.nombre || 'beneficiario';
  const rama = beneficiario.rama || '';
  const pagosAnio = pagos.filter(p => p.anio === anio);
  const mesesPagados = pagosAnio.flatMap(p => p.meses || (p.mes ? [p.mes] : []));
  const marzoGratis = marzoEsBonificado(afiliacion, esPrimeraVezAfiliacion);
  const esBecado = beneficiario.becado;

  // AFILIACIÓN
  let lineaAfiliacion = '';
  if (esPrimeraVezAfiliacion || afiliacion?.es_primera_vez) {
    lineaAfiliacion = `✅ *Afiliación/Seguro ${anio}:* Primera afiliación — bonificado`;
  } else if (afiliacion) {
    const pendAfi = (afiliacion.monto || 0) - (afiliacion.monto_pagado || 0);
    if (pendAfi <= 0) {
      lineaAfiliacion = `✅ *Afiliación/Seguro ${anio}:* Pagado (${formatMoney(afiliacion.monto)})`;
    } else {
      lineaAfiliacion = `❌ *Afiliación/Seguro ${anio}:* Pendiente ${formatMoney(pendAfi)} de ${formatMoney(afiliacion.monto)}`;
    }
  } else {
    lineaAfiliacion = `❌ *Afiliación/Seguro ${anio}:* Sin registrar — debe abonar`;
  }

  // CUOTAS
  let lineasCuotas = '';
  if (esBecado) {
    lineasCuotas = `🎖️ *Cuotas ${anio}:* Becado — sin cargo`;
  } else {
    const mesActual = new Date().getMonth(); // 0-indexed
    const anioActual = new Date().getFullYear();
    const mesesConDeuda = MESES.filter((mes, idxMes) => {
      if (MESES_SIN_CUOTA.includes(mes)) return false;
      if (mes === 'Marzo' && marzoGratis) return false;
      if (mesesPagados.includes(mes)) return false;
      if (anio < anioActual) return true;
      if (anio === anioActual) return idxMes <= mesActual;
      return false;
    });
    const mesesPagadosAnio = MESES.filter(mes => mesesPagados.includes(mes));
    if (mesesPagadosAnio.length > 0) lineasCuotas += `✅ *Cuotas pagadas:* ${mesesPagadosAnio.join(', ')}\n`;
    if (mesesConDeuda.length > 0) {
      lineasCuotas += `❌ *Cuotas adeudadas:* ${mesesConDeuda.join(', ')}`;
    } else {
      lineasCuotas += `✅ *Cuotas ${anio}:* Al día`;
    }
  }

  // CAMPAMENTOS
  let lineasCamp = '';
  if (campamentos.length > 0) {
    const pagosCamp = pagosAnio.filter(p => p.tipo_pago === 'Campamento');
    lineasCamp = '\n\n🏕️ *Campamentos:*';
    campamentos.forEach(c => {
      const pagado = pagosCamp.some(p => p.campamento_id === c.id);
      lineasCamp += `\n${pagado ? '✅' : '❌'} ${c.nombre}: ${formatMoney(c.costo_por_persona)}${pagado ? ' (pagado)' : ' (pendiente)'}`;
    });
  }

  // CRÉDITOS
  let lineasCreditos = '';
  const creditosDisp = creditos.filter(c => (c.monto_disponible || 0) > 0);
  if (creditosDisp.length > 0) {
    const totalCred = creditosDisp.reduce((s, c) => s + (c.monto_disponible || 0), 0);
    lineasCreditos = `\n\n💰 *Créditos disponibles:* ${formatMoney(totalCred)}`;
    creditosDisp.forEach(c => {
      lineasCreditos += `\n  • ${c.actividad_nombre || 'Actividad'}: ${formatMoney(c.monto_disponible)}`;
    });
    lineasCreditos += `\n  _(Podés usarlos para abonar cuotas o campamentos)_`;
  }

  // SALDO
  const saldo = beneficiario.saldo || 0;
  const lineaSaldo = saldo >= 0
    ? `\n\n✅ *Saldo ${anio}:* ${formatMoney(saldo)} (al día)`
    : `\n\n⚠️ *Saldo ${anio}:* ${formatMoney(saldo)} (deuda pendiente)`;

  return `Hola! 👋 Te escribimos desde el Grupo Scout para informarte el estado de cuenta de *${nombre}*${rama ? ` (${rama})` : ''}.

📋 *Resumen de cuenta ${anio}*

${lineaAfiliacion}

${lineasCuotas}${lineasCamp}${lineasCreditos}${lineaSaldo}

Ante cualquier consulta, no dudes en comunicarte con nosotros. ¡Muchas gracias! 🙏`;
}