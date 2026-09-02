import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, AlertCircle, Award, User, Plus, UserX, Gift, LayoutGrid, List, CalendarDays } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import CuentaDetalle from '@/components/cuenta/CuentaDetalle';
import ResumenDeudas from '@/components/cuenta/ResumenDeudas';
import GrillaCuotasMensuales from '@/components/cuenta/GrillaCuotasMensuales';
import PagoForm from '@/components/pagos/PagoForm';
import { RAMAS, TODOS_LOS_ROLES, CUOTA_EFECTIVO, CUOTA_TRANSFERENCIA, formatMoney, esBeneficiarioConCuota, getCuotaBeneficiario, marzoEsBonificado, calcularMesesQueGeneranDeuda, calcularMontoPorMes, calcularEsperadoPorMes } from '@/lib/ramaUtils';
import { getMontoSeguro } from '@/lib/afiliacionUtils';

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
  const [viewMode, setViewMode] = useState('lista'); // 'lista' | 'resumen' | 'grilla'
  const [sortBy, setSortBy] = useState('rama'); // 'rama' | 'deuda' | 'nombre'

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

  const { data: todosCreditos = [] } = useQuery({
    queryKey: ['creditos'],
    queryFn: () => base44.entities.CreditoBeneficiario.list(),
  });

  const { data: configAfiliaciones = [] } = useQuery({
    queryKey: ['config-afiliaciones'],
    queryFn: () => base44.entities.ConfigAfiliacion.list(),
  });

  // Solo calcular deudas desde 2026 en adelante
  const AÑO_INICIO = 2026;
  // Para cálculo de descuento hermanos: solo activos (inactivos no cuentan como hermanos que pagan)
  const activos = beneficiarios.filter(b => b.activo !== false);

  const cuentas = useMemo(() => {
    return beneficiarios.map(b => {
      const pagosDelBen = pagos.filter(p => p.beneficiario_id === b.id && p.anio === anio);
      const pagosCuotaBen = pagosDelBen.filter(p => p.tipo_pago !== 'Campamento');
      const montoPorMes = calcularMontoPorMes(pagosCuotaBen, b, activos);
      const esperadoPorMes = calcularEsperadoPorMes(pagosCuotaBen, b, activos);
      const cuotaIndividualCalc = esBeneficiarioConCuota(b) ? getCuotaBeneficiario(b, activos) : 0;
      // Meses totalmente pagados (total >= esperado según método de pago)
      const mesesPagados = Object.keys(montoPorMes).filter(m => (montoPorMes[m] || 0) >= (esperadoPorMes[m] || cuotaIndividualCalc) - 0.01);
      // Meses parcialmente pagados (0 < total < esperado)
      const mesesParciales = Object.keys(montoPorMes).filter(m => (montoPorMes[m] || 0) > 0 && (montoPorMes[m] || 0) < (esperadoPorMes[m] || cuotaIndividualCalc) - 0.01);
      const totalPagado = pagosDelBen.reduce((s, p) => s + (p.monto || 0), 0);

      // Campamentos donde participó (como niño o como adulto que paga)
      const esAdulto = ['Voluntario', 'Educador'].includes(b.rama) || b.tipo === 'Voluntario';
      const campBen = campamentos.filter(c =>
        esAdulto
          ? c.adultos_ids?.includes(b.id) && c.adultos_pagan
          : c.beneficiarios_ids?.includes(b.id)
      );
      const totalCampamentos = anio >= AÑO_INICIO ? campBen.reduce((s, c) => {
        if (esAdulto) return s + (c.costo_adultos || c.costo_por_persona || 0);
        return s + (c.costo_por_persona || 0);
      }, 0) : 0;
      // Restar lo pagado de campamentos
      const pagadoCamp = pagosDelBen.filter(p => p.tipo_pago === 'Campamento').reduce((s, p) => s + (p.monto || 0), 0);

      // Deuda cuotas: cálculo centralizado (alta + baja + reingreso). Solo desde AÑO_INICIO.
      const afiliacionAnio = afiliaciones.find(a => a.beneficiario_id === b.id && Number(a.anio) === Number(anio));
      const esPrimeraVez = !b.fecha_primer_afiliacion || afiliacionAnio?.es_primera_vez === true;
      const marzoGratis = marzoEsBonificado(afiliacionAnio, esPrimeraVez);
      const mesesQueGeneranDeuda = anio < AÑO_INICIO ? [] : calcularMesesQueGeneranDeuda(b, anio, afiliaciones);
      const cuotaIndividual = esAdulto ? 0 : getCuotaBeneficiario(b, activos);
      // Deuda pendiente de cuotas: suma de (esperado - pagado) por cada mes con deuda.
      // El monto esperado depende del método de pago usado (transferencia > efectivo).
      const deudaCuotas = (!esBeneficiarioConCuota(b)) ? 0 : mesesQueGeneranDeuda.reduce((s, m) => {
        const pagado = montoPorMes[m] || 0;
        const esperado = esperadoPorMes[m] || cuotaIndividual;
        return s + Math.max(0, esperado - pagado);
      }, 0);
      // Afiliación del año: el monto debido se calcula según el tipo_afiliacion actual
      const configAfil = configAfiliaciones.find(c => Number(c.anio) === Number(anio));
      const montoEsperadoAfil = getMontoSeguro(b, configAfil);
      let saldoAfiliacion = 0;
      if (!esPrimeraVez && anio >= AÑO_INICIO) {
        const montoPagadoAfiliacion = afiliacionAnio ? (afiliacionAnio.monto_pagado ?? 0) : 0;
        saldoAfiliacion = montoPagadoAfiliacion - montoEsperadoAfil;
      }

      const saldo = -deudaCuotas + pagadoCamp - totalCampamentos + saldoAfiliacion;

      const creditoDisponible = todosCreditos
        .filter(c => c.beneficiario_id === b.id && (c.monto_disponible || 0) > 0)
        .reduce((s, c) => s + (c.monto_disponible || 0), 0);

      return {
        ...b,
        mesesPagados,
        mesesParciales,
        montoPorMes,
        esperadoPorMes,
        totalPagado,
        totalCampamentos,
        saldo,
        saldoAfiliacion,
        afiliacionAnio,
        esPrimeraVezAfiliacion: esPrimeraVez,
        cuotaIndividual,
        tieneDescuentoHermanos: !esAdulto && cuotaIndividual < CUOTA_EFECTIVO_REF && esBeneficiarioConCuota(b),
        alDia: b.becado || saldo >= 0,
        marzoGratis,
        creditoDisponible,
        mesesDeuda: esBeneficiarioConCuota(b) ? mesesQueGeneranDeuda.filter(m => !mesesPagados.includes(m)) : [],
        deudaCampamento: Math.max(0, totalCampamentos - pagadoCamp),
      };
    });
  }, [activos, pagos, campamentos, afiliaciones, anio, todosCreditos, configAfiliaciones]);

  const filtered = cuentas.filter(c => {
    const matchSearch = !search || c.nombre?.toLowerCase().includes(search.toLowerCase());
    const matchDni = !filterDni || c.dni?.includes(filterDni);
    const matchRama = filterRama === 'todas' || c.rama === filterRama;
    const matchEstado = filterEstado === 'todos' || 
      (filterEstado === 'alDia' && c.alDia) || 
      (filterEstado === 'debe' && !c.alDia && !c.becado) || 
      (filterEstado === 'becado' && c.becado);
    const esAdultoFiltro = ['Voluntario', 'Educador'].includes(c.rama) || c.tipo === 'Voluntario';
    const tieneDeudaAfil = c.saldoAfiliacion < 0;
    const matchAfiliacion = filterAfiliacion === 'todos' ||
      (filterAfiliacion === 'conDeuda' && tieneDeudaAfil) ||
      (filterAfiliacion === 'afiliado' && c.afiliacionAnio && !tieneDeudaAfil) ||
      (filterAfiliacion === 'sinAfiliar' && !c.afiliacionAnio && !c.esPrimeraVezAfiliacion) ||
      (filterAfiliacion === 'primeraVez' && c.esPrimeraVezAfiliacion);
    // Filtro de activo/inactivo
    const esInactivo = c.activo === false;
    const matchActivo = filterActivo === 'todos' ||
      (filterActivo === 'activos' && !esInactivo) ||
      (filterActivo === 'inactivos' && esInactivo);
    // Para adultos sin campamento que pagar, siempre aparecen "al día"
    return matchSearch && matchDni && matchRama && matchEstado && matchAfiliacion && matchActivo;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'deuda') return a.saldo - b.saldo; // mayor deuda (más negativo) primero
    if (sortBy === 'nombre') return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    const ra = TODOS_LOS_ROLES.indexOf(a.rama) === -1 ? 99 : TODOS_LOS_ROLES.indexOf(a.rama);
    const rb = TODOS_LOS_ROLES.indexOf(b.rama) === -1 ? 99 : TODOS_LOS_ROLES.indexOf(b.rama);
    return ra !== rb ? ra - rb : (a.nombre || '').localeCompare(b.nombre || '', 'es');
  });

  const alDiaCount = filtered.filter(c => c.alDia).length;
  const conDeudaCount = filtered.filter(c => !c.alDia && !c.becado).length;

  if (selectedBen) {
    const cuenta = cuentas.find(c => c.id === selectedBen.id);
    const pagosDelBen = pagos.filter(p => p.beneficiario_id === selectedBen.id);
    const esAdultoDetalle = ['Voluntario', 'Educador'].includes(selectedBen.rama) || selectedBen.tipo === 'Voluntario';
    const campBen = campamentos.filter(c =>
      esAdultoDetalle
        ? c.adultos_ids?.includes(selectedBen.id)
        : c.beneficiarios_ids?.includes(selectedBen.id)
    );
    const configAfilDet = configAfiliaciones.find(c => Number(c.anio) === Number(anio));
    return <CuentaDetalle beneficiario={cuenta} pagos={pagosDelBen} campamentos={campBen} anio={anio} onBack={() => setSelectedBen(null)} afiliacion={cuenta?.afiliacionAnio} esPrimeraVezAfiliacion={cuenta?.esPrimeraVezAfiliacion} todosLosBeneficiarios={beneficiarios} configAfil={configAfilDet} />;
  }

  return (
    <div>
      <PageHeader title="Cuenta Corriente" description={`${alDiaCount} al día · ${conDeudaCount} con deuda`}>
        <div className="flex gap-2 flex-wrap">
          <Button variant={viewMode === 'lista' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('lista')}>
            <List className="w-4 h-4 mr-2" />Lista
          </Button>
          <Button variant={viewMode === 'grilla' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grilla')}>
            <CalendarDays className="w-4 h-4 mr-2" />Grilla mensual
          </Button>
          <Button variant={viewMode === 'resumen' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('resumen')}>
            <LayoutGrid className="w-4 h-4 mr-2" />Resumen deudas
          </Button>
          <Button onClick={() => { setPagoPreselected(null); setShowPagoForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />Registrar pago
          </Button>
        </div>
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
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rama">Ordenar por rama</SelectItem>
              <SelectItem value="deuda">Mayor deuda primero</SelectItem>
              <SelectItem value="nombre">Por nombre</SelectItem>
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

      {viewMode === 'resumen' ? (
        <ResumenDeudas cuentas={filtered} anio={anio} onSelectBen={setSelectedBen} onRegisterPago={(id) => { setPagoPreselected(id); setShowPagoForm(true); }} />
      ) : viewMode === 'grilla' ? (
        <GrillaCuotasMensuales cuentas={filtered} anio={anio} onSelectBen={setSelectedBen} />
      ) : (
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
              <TableHead className="hidden lg:table-cell text-primary">Créditos</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay beneficiarios</TableCell></TableRow>
            ) : (
              sorted.map(c => (
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
                  <TableCell className="hidden lg:table-cell" onClick={() => setSelectedBen(c)}>
                    {c.creditoDisponible > 0 ? (
                      <span className="inline-flex items-center gap-1 text-primary font-semibold text-sm">
                        <Gift className="w-3 h-3" />{formatMoney(c.creditoDisponible)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
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
      )}
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