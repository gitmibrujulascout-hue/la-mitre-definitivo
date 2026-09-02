import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, TrendingUp, TrendingDown, Wallet, Landmark, ArrowUpRight, ArrowDownLeft, Trash2, Upload, FileText, Gift } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ImportMovimientosBancoDialog from '@/components/caja/ImportMovimientosBancoDialog';
import CajaChicaPanel from '@/components/caja/CajaChicaPanel';
import ReporteCajaDialog from '@/components/caja/ReporteCajaDialog';
import { useFondos, buildMovimientos } from '@/lib/cajaUtils';

function MovimientoManualDialog({ open, onClose, cuentaDestino }) {
  const [form, setForm] = useState({
    tipo: 'Ingreso', concepto: '', monto: '',
    fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }), observaciones: '',
    forma_pago: cuentaDestino === 'Caja' ? 'Efectivo' : 'Transferencia',
  });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: data => base44.entities.MovimientoBanco.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Movimiento registrado');
      onClose();
    }
  });

  const handleSave = () => {
    if (!form.concepto || !form.monto) return;
    createMutation.mutate({
      ...form,
      monto: parseFloat(form.monto),
      origen: 'Manual',
      cuenta: cuentaDestino,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo movimiento — {cuentaDestino}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {['Ingreso', 'Egreso'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setForm(p => ({ ...p, tipo: t }))}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  form.tipo === t
                    ? t === 'Ingreso' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700'
                    : 'border-border'
                }`}
              >
                {t === 'Ingreso' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                {t}
              </button>
            ))}
          </div>
          <div>
            <Label>Concepto *</Label>
            <Input value={form.concepto} onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))} placeholder="Descripción del movimiento" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto *</Label>
              <Input type="number" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Observaciones</Label>
            <Input value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} placeholder="Opcional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.concepto || !form.monto}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Caja() {
  const [tab, setTab] = useState('caja');
  const [showNuevo, setShowNuevo] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showReporte, setShowReporte] = useState(false);
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const queryClient = useQueryClient();

  const { data: creditosTodos = [] } = useQuery({
    queryKey: ['creditos-todos'],
    queryFn: () => base44.entities.CreditoBeneficiario.list(),
  });

  const totalCreditosReservados = useMemo(
    () => creditosTodos.reduce((s, c) => s + (c.monto_disponible || 0), 0),
    [creditosTodos]
  );

  // Datos centralizados desde cajaUtils
  const { pagos, gastos, movimientosExtra, privateCampIds } = useFondos();

  const deleteMov = useMutation({
    mutationFn: refId => base44.entities.MovimientoBanco.delete(refId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] }); toast.success('Eliminado'); }
  });

  const anioFiltro = mostrarTodos ? null : anio;

  const movimientosCaja = useMemo(
    () => buildMovimientos({ pagos, gastos, movimientosExtra, privateCampIds, cuenta: 'Caja', anio: anioFiltro }),
    [pagos, gastos, movimientosExtra, anioFiltro, privateCampIds]
  );
  const movimientosBanco = useMemo(
    () => buildMovimientos({ pagos, gastos, movimientosExtra, privateCampIds, cuenta: 'Banco', anio: anioFiltro }),
    [pagos, gastos, movimientosExtra, anioFiltro, privateCampIds]
  );

  const movimientos = tab === 'caja' ? movimientosCaja : movimientosBanco;

  // Saldo inicial: arrastre de períodos anteriores al año filtrado
  const saldoInicial = useMemo(() => {
    if (!anioFiltro) return 0;
    const cuenta = tab === 'caja' ? 'Caja' : 'Banco';
    const todos = buildMovimientos({ pagos, gastos, movimientosExtra, privateCampIds, cuenta, anio: null });
    return todos
      .filter(m => (m.fecha || '') < anioFiltro)
      .reduce((s, m) => s + (m.tipo === 'Ingreso' ? (m.monto || 0) : -(m.monto || 0)), 0);
  }, [pagos, gastos, movimientosExtra, privateCampIds, anioFiltro, tab]);

  // Saldo acumulado por fila (arranca desde el saldo inicial, no desde 0)
  const movimientosConSaldo = useMemo(() => {
    let acum = saldoInicial;
    return movimientos.map(m => {
      acum += m.tipo === 'Ingreso' ? (m.monto || 0) : -(m.monto || 0);
      return { ...m, saldoAcumulado: acum };
    });
  }, [movimientos, saldoInicial]);

  const totalIngresos = movimientos.filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const totalEgresos = movimientos.filter(m => m.tipo === 'Egreso').reduce((s, m) => s + (m.monto || 0), 0);
  const saldo = saldoInicial + totalIngresos - totalEgresos;

  return (
    <div>
      <PageHeader title="Caja y Banco" description="Saldo y movimientos de fondos">
        <Select value={anio} onValueChange={v => { setAnio(v); setMostrarTodos(false); }}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027, 2028].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={mostrarTodos ? 'default' : 'outline'} size="sm" onClick={() => setMostrarTodos(p => !p)}>
          {mostrarTodos ? 'Filtrando: Todos' : 'Ver todos los años'}
        </Button>
        {tab === 'banco' && (
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" />Importar PDF banco
          </Button>
        )}
        <Button variant="outline" onClick={() => setShowReporte(true)}>
          <FileText className="w-4 h-4 mr-2" />Generar reporte
        </Button>
        <Button onClick={() => setShowNuevo(true)}>
          <Plus className="w-4 h-4 mr-2" />Movimiento manual
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="caja" className="gap-2"><Wallet className="w-4 h-4" />Caja</TabsTrigger>
          <TabsTrigger value="banco" className="gap-2"><Landmark className="w-4 h-4" />Banco</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Resumen */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ingresos</p>
                <p className="text-lg font-bold text-green-600">{formatMoney(totalIngresos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Egresos</p>
                <p className="text-lg font-bold text-red-500">{formatMoney(totalEgresos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn('border-2', saldo >= 0 ? 'border-green-300' : 'border-red-300')}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', saldo >= 0 ? 'bg-green-100' : 'bg-red-100')}>
                {tab === 'caja' ? <Wallet className={cn('w-5 h-5', saldo >= 0 ? 'text-green-600' : 'text-red-500')} /> : <Landmark className={cn('w-5 h-5', saldo >= 0 ? 'text-green-600' : 'text-red-500')} />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo {tab === 'caja' ? 'Caja' : 'Banco'}</p>
                <p className={cn('text-lg font-bold', saldo >= 0 ? 'text-green-600' : 'text-red-500')}>{formatMoney(saldo)}</p>
                {saldoInicial !== 0 && (
                  <p className="text-[10px] text-muted-foreground">incluye arrastre {formatMoney(saldoInicial)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn('border-2', totalCreditosReservados > 0 ? 'border-cyan-300' : 'border-border')}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', totalCreditosReservados > 0 ? 'bg-cyan-100' : 'bg-muted')}>
                <Gift className={cn('w-5 h-5', totalCreditosReservados > 0 ? 'text-cyan-600' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Créditos reservados</p>
                <p className={cn('text-lg font-bold', totalCreditosReservados > 0 ? 'text-cyan-600' : 'text-muted-foreground')}>{formatMoney(totalCreditosReservados)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Caja Chica — solo visible en pestaña Caja */}
      {tab === 'caja' && <CajaChicaPanel />}

      {/* Tabla de movimientos */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Fecha</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead className="hidden md:table-cell">Forma</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Saldo acum.</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movimientosConSaldo.length === 0 && saldoInicial === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay movimientos</TableCell></TableRow>
            ) : (
              <>
              {saldoInicial !== 0 && (
                <TableRow className="bg-yellow-50 font-semibold">
                  <TableCell className="text-xs text-muted-foreground">Anterior a {anioFiltro}</TableCell>
                  <TableCell colSpan={4} className="text-sm font-semibold text-muted-foreground italic">Saldo inicial del período</TableCell>
                  <TableCell className="text-right font-bold text-blue-700">{formatMoney(saldoInicial)}</TableCell>
                  <TableCell className="text-right font-bold text-blue-700">{formatMoney(saldoInicial)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
              {movimientosConSaldo.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-4 text-muted-foreground">Sin movimientos en {anioFiltro}</TableCell></TableRow>
              ) : (
              movimientosConSaldo.map((m, i) => (
                <TableRow key={`${m.id}-${i}`}>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{m.fecha || '—'}</TableCell>
                  <TableCell className="font-medium text-sm max-w-xs truncate">{m.concepto}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {m.esManual ? 'Manual' : m.origen || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {m.forma_pago ? (
                      <Badge variant="outline" className="text-xs whitespace-nowrap">{m.forma_pago}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={m.tipo === 'Ingreso'
                      ? 'bg-green-100 text-green-700 border-green-300 border'
                      : 'bg-red-100 text-red-700 border-red-300 border'
                    }>
                      {m.tipo === 'Ingreso' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownLeft className="w-3 h-3 mr-1" />}
                      {m.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn('font-semibold', m.tipo === 'Ingreso' ? 'text-green-600' : 'text-red-500')}>
                    {m.tipo === 'Egreso' ? '−' : '+'}{formatMoney(m.monto)}
                  </TableCell>
                  <TableCell className={cn('font-semibold text-sm', m.saldoAcumulado >= 0 ? 'text-foreground' : 'text-red-500')}>
                    {formatMoney(m.saldoAcumulado)}
                  </TableCell>
                  <TableCell>
                    {m.esManual ? (
                      <Button variant="ghost" size="icon" onClick={() => deleteMov.mutate(m.refId)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
              )}
              </>
            )}
          </TableBody>
        </Table>
      </Card>

      {showNuevo && (
        <MovimientoManualDialog
          open
          onClose={() => setShowNuevo(false)}
          cuentaDestino={tab === 'caja' ? 'Caja' : 'Banco'}
        />
      )}
      {showImport && (
        <ImportMovimientosBancoDialog open onClose={() => setShowImport(false)} />
      )}
      {showReporte && (
        <ReporteCajaDialog open onClose={() => setShowReporte(false)} cuentaInicial={tab === 'caja' ? 'Caja' : 'Banco'} />
      )}
    </div>
  );
}