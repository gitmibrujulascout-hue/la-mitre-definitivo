import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { MESES, MESES_SIN_CUOTA, formatMoney, marzoEsBonificado } from '@/lib/ramaUtils';

/**
 * Genera y abre web.whatsapp.com con un resumen de estado de cuenta del beneficiario.
 *
 * Props:
 *  - beneficiario: objeto completo (incluye nombre, telefono_contacto, saldo, etc.)
 *  - pagos: array de pagos del beneficiario (todos los años)
 *  - campamentos: array de campamentos en los que está anotado (con costo_por_persona)
 *  - anio: número
 *  - afiliacion: objeto de afiliación del año (puede ser null)
 *  - esPrimeraVezAfiliacion: boolean
 *  - creditos: array de CreditoBeneficiario disponibles
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
  const handleClick = () => {
    const telefono = limpiarTelefono(beneficiario.telefono_contacto);
    const mensaje = armarMensaje({ beneficiario, pagos, campamentos, anio, afiliacion, esPrimeraVezAfiliacion, creditos });
    const url = `https://web.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const tieneTelefono = !!beneficiario.telefono_contacto;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={!tieneTelefono}
      title={!tieneTelefono ? 'No hay teléfono cargado en la ficha' : 'Enviar resumen por WhatsApp'}
      className="text-green-700 border-green-300 hover:bg-green-50"
    >
      <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
      Enviar por WhatsApp
    </Button>
  );
}

// --- helpers ---

function limpiarTelefono(tel) {
  if (!tel) return '';
  // Eliminar espacios, guiones, paréntesis
  let limpio = tel.replace(/[\s\-().+]/g, '');
  // Si empieza con 0 (ej: 011...) → reemplazar 0 por 54
  if (limpio.startsWith('0')) limpio = '54' + limpio.slice(1);
  // Si no tiene prefijo de país y tiene 10 dígitos (ARG sin 0) → agregar 54
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

  // ----- AFILIACIÓN -----
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

  // ----- CUOTAS -----
  let lineasCuotas = '';
  if (esBecado) {
    lineasCuotas = `🎖️ *Cuotas ${anio}:* Becado — sin cargo`;
  } else {
    const mesesConDeuda = MESES.filter(mes => {
      if (MESES_SIN_CUOTA.includes(mes)) return false;
      if (mes === 'Marzo' && marzoGratis) return false;
      if (mesesPagados.includes(mes)) return false;
      // Solo los meses ya transcurridos (incluyendo el mes actual)
      const idxMes = MESES.indexOf(mes);
      const mesActual = new Date().getMonth(); // 0-indexed
      const anioActual = new Date().getFullYear();
      if (anio < anioActual) return true;
      if (anio === anioActual) return idxMes <= mesActual;
      return false;
    });

    const mesesPagadosAnio = MESES.filter(mes => mesesPagados.includes(mes));

    if (mesesPagadosAnio.length > 0) {
      lineasCuotas += `✅ *Cuotas pagadas:* ${mesesPagadosAnio.join(', ')}\n`;
    }
    if (mesesConDeuda.length > 0) {
      lineasCuotas += `❌ *Cuotas adeudadas:* ${mesesConDeuda.join(', ')}`;
    } else {
      lineasCuotas += `✅ *Cuotas ${anio}:* Al día`;
    }
  }

  // ----- CAMPAMENTOS -----
  let lineasCamp = '';
  if (campamentos.length > 0) {
    const pagosCamp = pagosAnio.filter(p => p.tipo_pago === 'Campamento');
    lineasCamp = '\n\n🏕️ *Campamentos:*';
    campamentos.forEach(c => {
      const pagado = pagosCamp.some(p => p.campamento_id === c.id);
      lineasCamp += `\n${pagado ? '✅' : '❌'} ${c.nombre}: ${formatMoney(c.costo_por_persona)}${pagado ? ' (pagado)' : ' (pendiente)'}`;
    });
  }

  // ----- CRÉDITOS -----
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

  // ----- SALDO FINAL -----
  const saldo = beneficiario.saldo || 0;
  const lineaSaldo = saldo >= 0
    ? `\n\n✅ *Saldo ${anio}:* ${formatMoney(saldo)} (al día)`
    : `\n\n⚠️ *Saldo ${anio}:* ${formatMoney(saldo)} (deuda pendiente)`;

  // ----- ARMAR MENSAJE -----
  const mensaje = `Hola! 👋 Te escribimos desde el Grupo Scout para informarte el estado de cuenta de *${nombre}*${rama ? ` (${rama})` : ''}.

📋 *Resumen de cuenta ${anio}*

${lineaAfiliacion}

${lineasCuotas}${lineasCamp}${lineasCreditos}${lineaSaldo}

Ante cualquier consulta, no dudes en comunicarte con nosotros. ¡Muchas gracias! 🙏`;

  return mensaje;
}