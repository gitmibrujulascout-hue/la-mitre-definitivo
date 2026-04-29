import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, AlertCircle, Award, User } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import CuentaDetalle from '@/components/cuenta/CuentaDetalle';
import { RAMAS, MESES, CUOTA_EFECTIVO, formatMoney } from '@/lib/ramaUtils';
import { cn } from '@/lib/utils';

export default function CuentaCorriente() {
  const [search, setSearch] = useState('');
  const [filterRama, setFilterRama] = useState('todas');
  const [selectedBen, setSelectedBen] = useState(null);
  const [anio, setAnio] = useState(new Date().getFullYear());

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

  const activos = beneficiarios.filter(b => b.activo !== false);

  const cuentas = useMemo(() => {
    return activos.map(b => {
      const pagosDelBen = pagos.filter(p => p.beneficiario_id === b.id && p.anio === anio);
      const mesesPagados = pagosDelBen.map(p => p.mes);
      const totalPagado = pagosDelBen.reduce((s, p) => s + (p.monto || 0), 0);

      // Campamentos donde participó
      const campBen = campamentos.filter(c => c.beneficiarios_ids?.includes(b.id));
      const totalCampamentos = campBen.reduce((s, c) => s + (c.costo_por_persona || 0), 0);

      // Deuda: cuota mensual * meses transcurridos + campamentos - pagos
      const mesActual = new Date().getMonth(); // 0-indexed
      const mesesTranscurridos = anio < new Date().getFullYear() ? 12 : anio > new Date().getFullYear() ? 0 : mesActual + 1;
      const deudaCuotas = b.becado ? 0 : mesesTranscurridos * CUOTA_EFECTIVO;
      const saldo = totalPagado - deudaCuotas - totalCampamentos;

      return {
        ...b,
        mesesPagados,
        totalPagado,
        totalCampamentos,
        saldo,
        alDia: b.becado || saldo >= 0,
      };
    });
  }, [activos, pagos, campamentos, anio]);

  const filtered = cuentas.filter(c => {
    const matchSearch = c.nombre?.toLowerCase().includes(search.toLowerCase());
    const matchRama = filterRama === 'todas' || c.rama === filterRama;
    return matchSearch && matchRama;
  });

  const alDiaCount = filtered.filter(c => c.alDia).length;

  if (selectedBen) {
    const cuenta = cuentas.find(c => c.id === selectedBen.id);
    const pagosDelBen = pagos.filter(p => p.beneficiario_id === selectedBen.id);
    const campBen = campamentos.filter(c => c.beneficiarios_ids?.includes(selectedBen.id));
    return <CuentaDetalle beneficiario={cuenta} pagos={pagosDelBen} campamentos={campBen} anio={anio} onBack={() => setSelectedBen(null)} />;
  }

  return (
    <div>
      <PageHeader title="Cuenta Corriente" description={`${alDiaCount}/${filtered.length} al día`} />

      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterRama} onValueChange={setFilterRama}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las ramas</SelectItem>
              {RAMAS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={anio.toString()} onValueChange={v => setAnio(parseInt(v))}>
            <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
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
              <TableHead className="hidden sm:table-cell">Pagado</TableHead>
              <TableHead>Saldo</TableHead>
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
                  onClick={() => setSelectedBen(c)}
                >
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell><RamaBadge rama={c.rama} /></TableCell>
                  <TableCell>
                    {c.becado ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-300 border"><Award className="w-3 h-3 mr-1" />Becado</Badge>
                    ) : c.alDia ? (
                      <Badge className="bg-green-100 text-green-700 border-green-300 border"><CheckCircle2 className="w-3 h-3 mr-1" />Al día</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 border-red-300 border"><AlertCircle className="w-3 h-3 mr-1" />Debe</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{formatMoney(c.totalPagado)}</TableCell>
                  <TableCell className={cn('font-semibold', c.saldo >= 0 ? 'text-green-600' : 'text-red-500')}>
                    {formatMoney(c.saldo)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}