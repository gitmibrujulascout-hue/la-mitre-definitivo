import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Upload, MoreHorizontal, Pencil, Trash2, Award, UserCog, Download, Eye, MessageCircle, AlertCircle, HeartPulse, Bell, Medal, Crown } from 'lucide-react';
import AsignarPanueloMasivoDialog from '@/components/beneficiarios/AsignarPanueloMasivoDialog';
import ImportarFichaSaludDialog from '@/components/beneficiarios/ImportarFichaSaludDialog';
import RevisionSolicitudesSaludDialog from '@/components/beneficiarios/RevisionSolicitudesSaludDialog';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import BeneficiarioForm from '@/components/beneficiarios/BeneficiarioForm';
import ImportBeneficiariosDialog from '@/components/beneficiarios/ImportBeneficiariosDialog';
import BeneficiarioFichaDialog from '@/components/beneficiarios/BeneficiarioFichaDialog';
import { TODOS_LOS_ROLES, MESES, MESES_SIN_CUOTA, getCuotaBeneficiario, esBeneficiarioConCuota, marzoEsBonificado } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function Beneficiarios() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDni, setFilterDni] = useState('');
  const [filterRama, setFilterRama] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('rama') || 'todas';
  });
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterFuncion, setFilterFuncion] = useState('todas');
  const [selected, setSelected] = useState([]);
  const [fichaOpen, setFichaOpen] = useState(null);
  const [fichasSaludOpen, setFichasSaludOpen] = useState(null);

  const [bajaConDeudaDialog, setBajaConDeudaDialog] = useState(null); // { data, hermanosIds, mesesDeudores, cuota }
  const [showRevisionSalud, setShowRevisionSalud] = useState(false);
  const [showPanueloMasivo, setShowPanueloMasivo] = useState(false);
  const queryClient = useQueryClient();

  const { data: beneficiarios = [], isLoading } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-created_date', 500),
  });

  const { data: afiliaciones = [] } = useQuery({
    queryKey: ['afiliaciones'],
    queryFn: () => base44.entities.Afiliacion.list('-fecha_pago', 500),
  });

  const { data: solicitudesSalud = [] } = useQuery({
    queryKey: ['solicitudes_salud'],
    queryFn: () => base44.entities.SolicitudCambioSalud.list('-created_date', 100),
  });
  const solicitudesPendientes = solicitudesSalud.filter(s => s.estado === 'Pendiente');

  const createMutation = useMutation({
    mutationFn: data => base44.entities.Beneficiario.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beneficiarios'] }); setShowForm(false); toast.success('Beneficiario creado'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Beneficiario.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beneficiarios'] }); setEditing(null); toast.success('Beneficiario actualizado'); },
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Beneficiario.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beneficiarios'] }); toast.success('Beneficiario eliminado'); },
  });

  const funciones = [...new Set(beneficiarios.map(b => b.funcion).filter(Boolean))].sort();

  const ORDEN_RAMAS = ['Lobatos', 'Tropa', 'KM', 'Rovers', 'Voluntario', 'Educador'];

  const filtered = beneficiarios
    .filter(b => {
      const matchSearch = !search || b.nombre?.toLowerCase().includes(search.toLowerCase());
      const matchDni = !filterDni || b.dni?.includes(filterDni);
      const matchRama = filterRama === 'todas' || b.rama === filterRama;
      const matchTipo = filterTipo === 'todos' || b.tipo === filterTipo || (!b.tipo && filterTipo === 'Beneficiario');
      const matchFuncion = filterFuncion === 'todas' || b.funcion === filterFuncion;
      return matchSearch && matchDni && matchRama && matchTipo && matchFuncion;
    })
    .sort((a, b) => {
      const ra = ORDEN_RAMAS.indexOf(a.rama) === -1 ? 99 : ORDEN_RAMAS.indexOf(a.rama);
      const rb = ORDEN_RAMAS.indexOf(b.rama) === -1 ? 99 : ORDEN_RAMAS.indexOf(b.rama);
      if (ra !== rb) return ra - rb;
      return (a.nombre || '').localeCompare(b.nombre || '', 'es');
    });

  const exportarCSV = () => {
    const cols = ['Nombre', 'DNI', 'Fecha Nac.', 'Rama', 'Tipo', 'Función', 'Teléfono', 'Email', 'Becado'];
    const rows = filtered.map(b => [
      b.nombre || '',
      b.dni || '',
      b.fecha_nacimiento || '',
      b.rama || '',
      b.tipo || '',
      b.funcion || '',
      b.telefono_contacto || '',
      b.email_contacto || '',
      b.becado ? 'Sí' : 'No',
    ]);
    const csv = [cols, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'beneficiarios.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const allFilteredIds = filtered.map(b => b.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.includes(id));
  const someSelected = selected.length > 0;

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(allSelected ? [] : allFilteredIds);

  const deleteSelected = async () => {
    if (!confirm(`¿Eliminar ${selected.length} beneficiario(s)?`)) return;
    for (const id of selected) await base44.entities.Beneficiario.delete(id);
    queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
    setSelected([]);
    toast.success(`${selected.length} beneficiarios eliminados`);
  };

  const doSave = async (data, hermanosIds = [], condonarDeuda = false) => {
    if (editing) {
      await base44.entities.Beneficiario.update(editing.id, data);
    } else {
      await base44.entities.Beneficiario.create(data);
    }

    // Si se condonan deudas: registrar un pago de $0 marcando los meses adeudados como "perdonados"
    // En realidad registramos los meses deudores como pagados con monto 0 y forma "Crédito actividad" para que el saldo quede en 0
    if (condonarDeuda && editing && bajaConDeudaDialog?.mesesDeudores?.length > 0) {
      const anio = new Date().getFullYear();
      await base44.entities.Pago.create({
        beneficiario_id: editing.id,
        beneficiario_nombre: data.nombre,
        tipo_pago: 'Cuota',
        meses: bajaConDeudaDialog.mesesDeudores,
        anio,
        forma_pago: 'Efectivo',
        destino: 'Caja',
        monto: 0,
        fecha_pago: new Date().toISOString().split('T')[0],
        observaciones: 'Deuda condonada por baja del beneficiario',
      });
    }

    // Actualizar grupo_familiar en los hermanos seleccionados
    if (hermanosIds.length > 0 && data.grupo_familiar) {
      await Promise.all(
        hermanosIds.map(id => base44.entities.Beneficiario.update(id, { grupo_familiar: data.grupo_familiar }))
      );
    }
    // Si se des-vincularon hermanos, limpiarles el grupo
    if (editing && editing.grupo_familiar) {
      const exHermanos = beneficiarios.filter(b =>
        b.id !== editing.id &&
        b.grupo_familiar === editing.grupo_familiar &&
        !hermanosIds.includes(b.id)
      );
      if (exHermanos.length > 0 && data.grupo_familiar !== editing.grupo_familiar) {
        await Promise.all(exHermanos.map(b => base44.entities.Beneficiario.update(b.id, { grupo_familiar: '' })));
      }
    }

    queryClient.invalidateQueries({ queryKey: ['beneficiarios'] });
    queryClient.invalidateQueries({ queryKey: ['pagos'] });
    setBajaConDeudaDialog(null);
    if (editing) { setEditing(null); toast.success('Beneficiario actualizado'); }
    else { setShowForm(false); toast.success('Beneficiario creado'); }
  };

  const handleSave = async (data, hermanosIds = []) => {
    // Detectar si es una baja (antes estaba activo, ahora no)
    const esNuevaBaja = editing && editing.activo !== false && data.activo === false;
    if (esNuevaBaja && esBeneficiarioConCuota(editing)) {
      // Calcular meses adeudados del año actual
      const anio = new Date().getFullYear();
      const mesActual = new Date().getMonth(); // 0-based
      const pagosDelBen = pagos.filter(p => p.beneficiario_id === editing.id && p.anio === anio && p.tipo_pago !== 'Campamento');
      const mesesPagados = new Set(pagosDelBen.flatMap(p => p.meses || (p.mes ? [p.mes] : [])));
      const afiliacionAnio = afiliaciones.find(a => a.beneficiario_id === editing.id && Number(a.anio) === anio);
      const esPrimeraVez = !editing.fecha_primer_afiliacion;
      const marzoGratis = marzoEsBonificado(afiliacionAnio, esPrimeraVez);

      // Mes hasta el que genera deuda según la fecha de baja indicada
      let mesUltimoCuota = 11;
      if (data.fecha_baja) {
        const [, mesBaja] = data.fecha_baja.split('T')[0].split('-').map(Number);
        mesUltimoCuota = mesBaja - 1;
      } else {
        mesUltimoCuota = mesActual;
      }

      const mesesDeudores = MESES.slice(0, mesUltimoCuota + 1).filter((m, idx) => {
        if (MESES_SIN_CUOTA.includes(m)) return false;
        if (m === 'Marzo' && marzoGratis) return false;
        if (mesesPagados.has(m)) return false;
        return true;
      });

      if (mesesDeudores.length > 0) {
        const cuota = getCuotaBeneficiario(editing, beneficiarios);
        setBajaConDeudaDialog({ data, hermanosIds, mesesDeudores, cuota });
        return; // Esperar decisión del usuario
      }
    }
    await doSave(data, hermanosIds, false);
  };

  return (
    <div>
      <PageHeader title="Beneficiarios" description="Gestión de miembros del grupo scout">
        {solicitudesPendientes.length > 0 && (
          <Button variant="outline" className="relative border-amber-400 text-amber-700 hover:bg-amber-50" onClick={() => setShowRevisionSalud(true)}>
            <Bell className="w-4 h-4 mr-2" />
            Revisar cambios de salud
            <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{solicitudesPendientes.length}</span>
          </Button>
        )}
        <Button variant="outline" onClick={() => setShowPanueloMasivo(true)}>
          <Crown className="w-4 h-4 mr-2" />Pañuelos
        </Button>
        <Button variant="outline" onClick={exportarCSV}>
          <Download className="w-4 h-4 mr-2" />Exportar
        </Button>
        <Button variant="outline" onClick={() => setShowImport(true)}>
          <Upload className="w-4 h-4 mr-2" />Importar
        </Button>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />Nuevo
        </Button>
      </PageHeader>

      {/* Filtros */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Input placeholder="Filtrar por DNI..." value={filterDni} onChange={e => setFilterDni(e.target.value)} className="w-full sm:w-44" />
          <Select value={filterRama} onValueChange={setFilterRama}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las ramas</SelectItem>
              {TODOS_LOS_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              <SelectItem value="Beneficiario">Solo beneficiarios</SelectItem>
              <SelectItem value="Voluntario">Solo voluntarios</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterFuncion} onValueChange={setFilterFuncion}>
            <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Todas las funciones" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las funciones</SelectItem>
              {funciones.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Barra de acciones masivas */}
      {someSelected && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary">{selected.length} seleccionado(s)</span>
          <Button size="sm" variant="destructive" onClick={deleteSelected}>
            <Trash2 className="w-4 h-4 mr-1" />Eliminar seleccionados
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelected([])}>Deseleccionar</Button>
        </div>
      )}

      {/* Tabla */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rama</TableHead>
              <TableHead className="hidden sm:table-cell">DNI</TableHead>
              <TableHead className="hidden md:table-cell">Función</TableHead>
              <TableHead className="hidden lg:table-cell">Cumpleaños</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay beneficiarios</TableCell></TableRow>
            ) : (
              filtered.map(b => {
                const edad = b.fecha_nacimiento
                  ? Math.floor((new Date() - new Date(b.fecha_nacimiento)) / (365.25 * 24 * 3600 * 1000))
                  : null;
                const isChecked = selected.includes(b.id);
                return (
                <TableRow key={b.id} className={`hover:bg-muted/30 ${isChecked ? 'bg-primary/5' : ''}`}>
                  <TableCell>
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleSelect(b.id)} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {b.nombre}
                    {edad !== null && edad < 25 && <span className="text-muted-foreground font-normal ml-1">({edad} años)</span>}
                  </TableCell>
                  <TableCell><RamaBadge rama={b.rama} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{b.dni || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{b.funcion || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {b.fecha_nacimiento ? (() => {
                      const [y, m, d] = b.fecha_nacimiento.split('-');
                      return `${d}/${m}/${y}`;
                    })() : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {!b.activo && (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-300 border"><AlertCircle className="w-3 h-3 mr-1" />Inactivo</Badge>
                      )}
                      {b.tipo === 'Voluntario' && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-300 border"><UserCog className="w-3 h-3 mr-1" />Voluntario</Badge>
                      )}
                      {b.becado && b.tipo !== 'Voluntario' && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-300 border"><Award className="w-3 h-3 mr-1" />Becado</Badge>
                      )}
                      {b.estado_panuelo === 'Paturuzú' && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-400 border" title="Pañuelo: Paturuzú (equipo especial)">
                          <Crown className="w-3 h-3 mr-1" />Paturuzú
                        </Badge>
                      )}
                      {b.estado_panuelo && b.estado_panuelo !== 'Paturuzú' && (
                        <Badge className={b.estado_panuelo === 'Promesa' ? 'bg-blue-100 text-blue-700 border-blue-300 border' : 'bg-indigo-100 text-indigo-700 border-indigo-300 border'} title={`Pañuelo: ${b.estado_panuelo}`}>
                          <img
                            src={b.estado_panuelo === 'Promesa'
                              ? "https://media.base44.com/images/public/69f1ed5d29db0dc5bc7e0ef8/9f0e84abb_Gemini_Generated_Image_pm52inpm52inpm52.png"
                              : "https://media.base44.com/images/public/69f1ed5d29db0dc5bc7e0ef8/030bc09bd_Gemini_Generated_Image_pm52inpm52inpm52-copia.png"}
                            alt={b.estado_panuelo}
                            className="w-3.5 h-3.5 mr-1 object-contain inline-block align-middle"
                          />{b.estado_panuelo}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(b.telefono_contacto || b.telefono_contacto_2) && (
                        <a
                          href={(() => {
                            const num = (b.telefono_contacto || b.telefono_contacto_2).replace(/\D/g, '');
                            const full = num.startsWith('54') ? num : `54${num}`;
                            return `https://web.whatsapp.com/send?phone=${full}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="icon" title="Enviar WhatsApp">
                            <MessageCircle className="w-4 h-4 text-green-600" />
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setFichaOpen(b)}>
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditing(b); }}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFichasSaludOpen(b)}><HeartPulse className="w-4 h-4 mr-2" />Importar ficha de salud</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(b.id)}><Trash2 className="w-4 h-4 mr-2" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )})
            )}
          </TableBody>
        </Table>
      </Card>

      {showForm && <BeneficiarioForm open onClose={() => setShowForm(false)} onSave={handleSave} todosBeneficiarios={beneficiarios} />}
      {editing && <BeneficiarioForm open onClose={() => setEditing(null)} onSave={handleSave} initialData={editing} todosBeneficiarios={beneficiarios} />}
      {showImport && <ImportBeneficiariosDialog open onClose={() => setShowImport(false)} />}
      {showPanueloMasivo && (
        <AsignarPanueloMasivoDialog
          open
          onClose={() => setShowPanueloMasivo(false)}
          beneficiarios={beneficiarios}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['beneficiarios'] })}
        />
      )}
      {fichaOpen && <BeneficiarioFichaDialog open onClose={() => setFichaOpen(null)} beneficiario={fichaOpen} />}
      {fichasSaludOpen && <ImportarFichaSaludDialog open onClose={() => setFichasSaludOpen(null)} beneficiario={fichasSaludOpen} />}
      {showRevisionSalud && (
        <RevisionSolicitudesSaludDialog
          open
          onClose={() => setShowRevisionSalud(false)}
          solicitudes={solicitudesSalud}
          beneficiarios={beneficiarios}
        />
      )}

      {/* Diálogo de condonación de deuda al dar de baja */}
      {bajaConDeudaDialog && (
        <Dialog open onOpenChange={() => setBajaConDeudaDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Baja con cuotas adeudadas</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">
                El beneficiario tiene <strong>{bajaConDeudaDialog.mesesDeudores.length} cuota(s) sin pagar</strong> del año en curso:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {bajaConDeudaDialog.mesesDeudores.map(m => (
                  <span key={m} className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-medium">{m}</span>
                ))}
              </div>
              <p className="text-sm font-semibold text-red-600">
                Total adeudado: ${(bajaConDeudaDialog.mesesDeudores.length * bajaConDeudaDialog.cuota).toLocaleString('es-AR')}
              </p>
              <p className="text-sm text-muted-foreground">¿Desea condonar (perdonar) esta deuda al dar la baja?</p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => doSave(bajaConDeudaDialog.data, bajaConDeudaDialog.hermanosIds, false)}>
                No, mantener deuda
              </Button>
              <Button variant="destructive" onClick={() => doSave(bajaConDeudaDialog.data, bajaConDeudaDialog.hermanosIds, true)}>
                Sí, condonar deuda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}