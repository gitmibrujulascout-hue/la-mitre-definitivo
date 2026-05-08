import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, AlertCircle, Award, User, Plus, UserX } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import CuentaDetalle from '@/components/cuenta/CuentaDetalle';
import PagoForm from '@/components/pagos/PagoForm';
import { RAMAS, TODOS_LOS_ROLES, MESES, MESES_SIN_CUOTA, CUOTA_EFECTIVO, CUOTA_TRANSFERENCIA, formatMoney, esBeneficiarioConCuota, getCuotaBeneficiario, marzoEsBonificado } from '@/lib/ramaUtils';
import { MONTO_SEGURO_AFILIACION } from '@/lib/registros';

const CUOTA_EFECTIVO_REF = CUOTA_EFECTIVO;
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function CuentaCorriente() {
  const [search, setSearch] = useState('');
  const [filterDni, setFilterDni] = useState('');
  const [filterRama, setFilterRama] = useState('todas');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterAfiliacion, setFilterAfiliacion] = useState('todos');
  const [filterActivo, setFilterActivo] = useState('activos');
  const [selectedBen, setSelectedBen] = useState(null);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [pagoPreselected, setPagoPreselected] = useState(null);

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-created_date', 500),
  });

  const { data: campamentos = [] } = useQuery({
    queryKey: ['campamentos'],
    queryFn: () => base44.entities.Campamento.list(),
  });

  const { data: afiliaciones = [] } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 500),
  });

  // Solo calcular deudas desde 2026 en adelante
  const AÑO_INICIO = 2026;
  // Incluir a todos (activos e inactivos): los inactivos pueden tener deuda histórica
  const activos = beneficiarios;

  const cuentas = useMemo(() => {
    return activos.map(b => {
      const pagosDelBen = pagos.filter(p => p.beneficiario_id === b.id && p.anio === anio);
      const mesesPagados = pagosDelBen
        .filter(p => p.tipo_pago !== 'Campamento')
        .flatMap(p => p.meses || (p.mes ? [p.mes] : []));
      const totalPagado = pagosDelBen.reduce((s, p) => s + (p.monto || 0), 0);

      // Campamentos donde participó (solo deuda si el año es >= AÑO_INICIO)
      const campBen = campamentos.filter(c => c.beneficiarios_ids?.includes(b.id));
      const totalCampamentos = anio >= AÑO_INICIO ? campBen.reduce((s, c) => s + (c.costo_por_persona || 0), 0) : 0;
      // Restar lo pagado de campamentos
      const pagadoCamp = pagosDelBen.filter(p => p.tipo_pago === 'Campamento').reduce((s, p) => s + (p.monto || 0), 0);

      // Deuda cuotas: solo desde AÑO_INICIO
      const mesActual = new Date().getMonth();
      const mesesTranscurridos = anio < new Date().getFullYear() ? 12 : anio > new Date().getFullYear() ? 0 : mesActual + 1;
      const afiliacionAnio = afiliaciones.find(a => a.beneficiario_id === b.id && Number(a.anio) === Number(anio));
      const esPrimeraVez = !b.fecha_primer_afiliacion;
      const marzoGratis = marzoEsBonificado(afiliacionAnio, esPrimeraVez);
      // Mes desde el que el beneficiario empieza a abonar cuota.
      // Solo aplica si tiene fecha_primer_afiliacion en el año en curso (se incorporó este año).
      // En ese caso, los meses anteriores a su incorporación no generan deuda.
      let mesPrimerCuota = 0; // por defecto, desde el inicio del año
      if (b.fecha_primer_afiliacion) {
        const [anioAfil, mesAfil] = b.fecha_primer_afiliacion.split('T')[0].split('-').map(Number);
        if (anioAfil === anio) {
          mesPrimerCuota = mesAfil - 1; // índice 0-based (Enero=0)
        }
      }

      // Mes de baja: si el beneficiario está inactivo y tiene fecha_baja en este año,
      // los meses a partir de ese mes no generan deuda
      let mesUltimoCuota = 11; // por defecto, hasta Diciembre
      if (b.activo === false && b.fecha_baja) {
        const [anioBaja, mesBaja] = b.fecha_baja.split('T')[0].split('-').map(Number);
        if (anioBaja === anio) {
          mesUltimoCuota = mesBaja - 2; // índice del último mes que DEBE pagar (mes baja - 1)
        } else if (anioBaja < anio) {
          mesUltimoCuota = -1; // dado de baja antes de este año → no debe nada
        }
      }

      const mesesQueGeneranDeuda = anio < AÑO_INICIO ? [] : MESES.slice(0, mesesTranscurridos).filter((m, idx) => {
        if (MESES_SIN_CUOTA.includes(m)) return false;
        if (m === 'Marzo' && marzoGratis) return false;
        if (idx < mesPrimerCuota) return false; // meses anteriores al inicio no generan deuda
        if (idx > mesUltimoCuota) return false; // meses posteriores a la baja no generan deuda
        return true;
      });
      const cuotaIndividual = getCuotaBeneficiario(b, activos);
      const deudaCuotas = (!esBeneficiarioConCuota(b)) ? 0 : mesesQueGeneranDeuda.length * cuotaIndividual;
      // Para el saldo del beneficiario, los pagos por transferencia se computan a valor efectivo
      // (los $2.000 extra son impuestos bancarios que no son deuda del beneficiario)
      const pagadoCuotas = pagosDelBen
        .filter(p => p.tipo_pago !== 'Campamento')
        .reduce((s, p) => {
          if (p.forma_pago === 'Transferencia' && p.meses?.length > 0) {
            const cuotaBenEfectivo = getCuotaBeneficiario(b, activos);
            return s + p.meses.length * cuotaBenEfectivo;
          }
          return s + (p.monto || 0);
        }, 0);
      // Afiliación del año (ya calculado arriba)
      let saldoAfiliacion = 0;
      if (!esPrimeraVez && anio >= AÑO_INICIO) {
        // Debe pagar afiliación: si no tiene registro o tiene saldo pendiente
        const montoPagadoAfiliacion = afiliacionAnio ? (afiliacionAnio.monto_pagado || afiliacionAnio.monto || 0) : 0;
        const montoDebidoAfiliacion = afiliacionAnio ? (afiliacionAnio.monto || MONTO_SEGURO_AFILIACION) : MONTO_SEGURO_AFILIACION;
        saldoAfiliacion = montoPagadoAfiliacion - montoDebidoAfiliacion;
      }

      const saldo = pagadoCuotas - deudaCuotas + pagadoCamp - totalCampamentos + saldoAfiliacion;

      return {
        ...b,
        mesesPagados,
        totalPagado,
        totalCampamentos,
        saldo,
        saldoAfiliacion,
        afiliacionAnio,
        esPrimeraVezAfiliacion: esPrimeraVez,
        cuotaIndividual,
        tieneDescuentoHermanos: cuotaIndividual < CUOTA_EFECTIVO_REF && esBeneficiarioConCuota(b),
        alDia: b.becado || saldo >= 0,
      };
    });
  }, [activos, pagos, campamentos, afiliaciones, anio]);

  const filtered = cuentas.filter(c => {
    const matchSearch = !search || c.nombre?.toLowerCase().includes(search.toLowerCase());
    const matchDni = !filterDni || c.dni?.includes(filterDni);
    const matchRama = filterRama === 'todas' || c.rama === filterRama;
    const matchEstado = filterEstado === 'todos' || 
      (filterEstado === 'alDia' && c.alDia) || 
      (filterEstado === 'debe' && !c.alDia && !c.becado) || 
      (filterEstado === 'becado' && c.becado);
    const esAdulto = ['Voluntario', 'Educador'].includes(c.rama) || c.tipo === 'Voluntario';
    const tieneDeudaAfil = c.saldoAfiliacion < 0;
    const matchAfiliacion = filterAfiliacion === 'todos' ||
      (filterAfiliacion === 'conDeuda' && tieneDeudaAfil) ||
      (filterAfiliacion === 'afiliado' && c.afiliacionAnio && !tieneDeudaAfil) ||
      (filterAfiliacion === 'sinAfiliar' && !c.afiliacionAnio && !c.esPrimeraVezAfiliacion) ||
      (filterAfiliacion === 'primeraVez' && c.esPrimeraVezAfiliacion);
    // Ocultar adultos sin deuda de afiliación para no saturar la lista
    if (esAdulto && !tieneDeudaAfil) return false;
    // Filtro de activo/inactivo
    const esInactivo = c.activo === false;
    const matchActivo = filterActivo === 'todos' ||
      (filterActivo === 'activos' && !esInactivo) ||
      (filterActivo === 'inactivos' && esInactivo);
    return matchSearch && matchDni && matchRama && matchEstado && matchAfiliacion && matchActivo;
  });

  const alDiaCount = filtered.filter(c => c.alDia).length;
  const conDeudaCount = filtered.filter(c => !c.alDia && !c.becado).length;

  if (selectedBen) {
    const cuenta = cuentas.find(c => c.id === selectedBen.id);
    const pagosDelBen = pagos.filter(p => p.beneficiario_id === selectedBen.id);
    const campBen = campamentos.filter(c => c.beneficiarios_ids?.includes(selectedBen.id));
    return <CuentaDetalle beneficiario={cuenta} pagos={pagosDelBen} campamentos={campBen} anio={anio} onBack={() => setSelectedBen(null)} afiliacion={cuenta?.afiliacionAnio} esPrimeraVezAfiliacion={cuenta?.esPrimeraVezAfiliacion} todosLosBeneficiarios={beneficiarios} />;
  }

  return (
    <div>
      <PageHeader title="Cuenta Corriente" description={`${alDiaCount} al día · ${conDeudaCount} con deuda`}>
        <Button onClick={() => { setPagoPreselected(null); setShowPagoForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />Registrar pago
        </Button>
      </PageHeader>

      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Input placeholder="Filtrar por DNI..." value={filterDni} onChange={e => setFilterDni(e.target.value)} className="w-full sm:w-40" />
          <Select value={filterRama} onValueChange={setFilterRama}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las ramas</SelectItem>
              {TODOS_LOS_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="alDia">Al día</SelectItem>
              <SelectItem value="debe">Debe</SelectItem>
              <SelectItem value="becado">Becado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAfiliacion} onValueChange={setFilterAfiliacion}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Toda afiliación</SelectItem>
              <SelectItem value="conDeuda">Con deuda afiliación</SelectItem>
              <SelectItem value="afiliado">Afiliado al día</SelectItem>
              <SelectItem value="sinAfiliar">Sin afiliar</SelectItem>
              <SelectItem value="primeraVez">Primera vez</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterActivo} onValueChange={setFilterActivo}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activos">Solo activos</SelectItem>
              <SelectItem value="inactivos">Solo inactivos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={anio.toString()} onValueChange={v => setAnio(parseInt(v))}>
            <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2026, 2027, 2028].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Beneficiario</TableHead>
              <TableHead>Rama</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden md:table-cell">Afiliación</TableHead>
              <TableHead className="hidden sm:table-cell">Pagado</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay beneficiarios</TableCell></TableRow>
            ) : (
              filtered.map(c => (
                <TableRow 
                  key={c.id} 
                  className="cursor-pointer hover:bg-muted/30"
                >
                  <TableCell className="font-medium" onClick={() => setSelectedBen(c)}>
                    <div className="flex items-center gap-2">
                      {c.nombre}
                      {c.activo === false && (
                        <Badge className="bg-slate-100 text-slate-500 border-slate-300 border text-xs"><UserX className="w-3 h-3 mr-1" />Inactivo</Badge>
                      )}
                    </div>
                    {c.tieneDescuentoHermanos && (
                      <span className="text-xs text-blue-600 font-normal">Hermanos · {formatMoney(c.cuotaIndividual)}/mes</span>
                    )}
                    {c.activo === false && c.fecha_baja && (
                      <span className="text-xs text-slate-400">Baja: {c.fecha_baja.split('T')[0]}</span>
                    )}
                  </TableCell>
                  <TableCell onClick={() => setSelectedBen(c)}><RamaBadge rama={c.rama} /></TableCell>
                  <TableCell onClick={() => setSelectedBen(c)}>
                    {c.becado ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 border"><Award className="w-3 h-3 mr-1" />Becado</Badge>
                    ) : c.alDia ? (
                      <Badge className="bg-green-100 text-green-700 border-green-300 border"><CheckCircle2 className="w-3 h-3 mr-1" />Al día</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-red-300 border"><AlertCircle className="w-3 h-3 mr-1" />Debe</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell" onClick={() => setSelectedBen(c)}>
                    {c.esPrimeraVezAfiliacion ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">⭐ Sin costo</Badge>
                    ) : c.afiliacionAnio ? (
                      c.afiliacionAnio.es_primera_vez ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-300 border text-xs">⭐ Sin costo</Badge>
                      ) : (c.afiliacionAnio.monto_pagado || c.afiliacionAnio.monto || 0) >= (c.afiliacionAnio.monto || 14000) ? (
                        <Badge className="bg-green-100 text-green-700 border-green-300 border text-xs">✓ Afiliado</Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-300 border text-xs">Parcial</Badge>
                      )
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-red-300 border text-xs">Sin afiliar</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell" onClick={() => setSelectedBen(c)}>{formatMoney(c.totalPagado)}</TableCell>
                  <TableCell className={cn('font-semibold', c.saldo >= 0 ? 'text-green-600' : 'text-red-500')} onClick={() => setSelectedBen(c)}>
                    {formatMoney(c.saldo)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={e => { e.stopPropagation(); setPagoPreselected(c.id); setShowPagoForm(true); }}
                    >
                      <Plus className="w-3 h-3 mr-1" />Pago
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
      {showPagoForm && (
        <PagoForm
          open
          onClose={() => { setShowPagoForm(false); setPagoPreselected(null); }}
          beneficiarios={beneficiarios}
          preselectedBenId={pagoPreselected}
        />
      )}
    </div>
  );
}