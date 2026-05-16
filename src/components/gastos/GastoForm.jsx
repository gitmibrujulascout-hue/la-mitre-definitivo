import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { registrarGasto, actualizarGasto } from '@/lib/registros';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@/lib/ramaUtils';
import { Upload, Loader2, Sparkles, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORIAS = ['Materiales', 'Alimentos', 'Transporte', 'Servicios', 'Mantenimiento', 'Campamento', 'Otro'];

export default function GastoForm({ open, onClose, initialData }) {
  const isEditing = !!initialData;
  const [tab, setTab] = useState('manual');

  const { data: campamentos = [] } = useQuery({
    queryKey: ['campamentos'],
    queryFn: () => base44.entities.Campamento.list(),
    select: data => data.filter(c => c.nombre),
  });
  const { data: actividades = [] } = useQuery({
    queryKey: ['actividades'],
    queryFn: () => base44.entities.ActividadEconomica.list('-fecha', 100),
    select: data => data.filter(a => a.estado !== 'Finalizada'),
  });
  const [form, setForm] = useState(initialData ? {
    descripcion: initialData.descripcion || '',
    monto: initialData.monto || '',
    fecha: initialData.fecha || new Date().toISOString().split('T')[0],
    categoria: initialData.categoria || '',
    proveedor: initialData.proveedor || '',
    numero_factura: initialData.numero_factura || '',
    archivo_url: initialData.archivo_url || '',
    observaciones: initialData.observaciones || '',
    forma_pago: initialData.forma_pago || '',
    destino: initialData.destino || '',
    campamento_id: initialData.campamento_id || '',
    campamento_nombre: initialData.campamento_nombre || '',
    actividad_id: initialData.actividad_id || '',
    actividad_nombre: initialData.actividad_nombre || '',
  } : {
    descripcion: '', monto: '', fecha: new Date().toISOString().split('T')[0],
    categoria: '', proveedor: '', numero_factura: '', archivo_url: '', observaciones: '',
    forma_pago: '', destino: '', campamento_id: '', campamento_nombre: '',
    actividad_id: '', actividad_nombre: '',
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: data => registrarGasto(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos'] });
      onClose();
      toast.success('Gasto registrado');
    },
  });
  const updateMutation = useMutation({
    mutationFn: data => actualizarGasto(initialData.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gastos'] }); onClose(); toast.success('Gasto actualizado'); },
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleFileUpload = async () => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    update('archivo_url', file_url);
    setUploading(false);
    toast.success('Archivo subido');
    return file_url;
  };

  const handleExtractFromFile = async () => {
    if (!file) return;
    setExtracting(true);
    let fileUrl = form.archivo_url;
    if (!fileUrl) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      fileUrl = file_url;
      update('archivo_url', fileUrl);
    }

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: {
        type: "object",
        properties: {
          descripcion: { type: "string", description: "Descripción del producto o servicio" },
          monto_total: { type: "number", description: "Monto total del recibo o factura" },
          fecha: { type: "string", description: "Fecha de la factura en formato YYYY-MM-DD" },
          proveedor: { type: "string", description: "Nombre del proveedor o comercio" },
          numero_factura: { type: "string", description: "Número de factura o recibo" },
          categoria: { type: "string", enum: CATEGORIAS }
        }
      }
    });

    if (result.status === 'success' && result.output) {
      const d = result.output;
      setForm(prev => ({
        ...prev,
        descripcion: d.descripcion || prev.descripcion,
        monto: d.monto_total || prev.monto,
        fecha: d.fecha || prev.fecha,
        proveedor: d.proveedor || prev.proveedor,
        numero_factura: d.numero_factura || prev.numero_factura,
        categoria: d.categoria || prev.categoria,
        archivo_url: fileUrl,
      }));
      toast.success('Datos extraídos correctamente. Verificá y corregí si es necesario.');
    } else {
      toast.error('No se pudieron extraer todos los datos. Completá manualmente.');
    }
    setExtracting(false);
  };

  const handleSave = () => {
    if (!form.descripcion || !form.monto) return;
    const destino = form.forma_pago === 'Transferencia' ? 'Banco' : 'Caja';
    const camp = campamentos.find(c => c.id === form.campamento_id);
    const activ = actividades.find(a => a.id === form.actividad_id);
    const data = {
      ...form,
      monto: parseFloat(form.monto),
      destino,
      campamento_nombre: camp?.nombre || '',
      actividad_nombre: activ?.nombre || '',
    };
    if (isEditing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Gasto' : 'Registrar Gasto'}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
            <TabsTrigger value="archivo" className="flex-1">Desde archivo</TabsTrigger>
          </TabsList>

          <TabsContent value="archivo" className="space-y-4 pt-4">
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} className="hidden" id="gasto-file" />
              <label htmlFor="gasto-file" className="cursor-pointer">
                <p className="text-sm font-medium text-primary">Seleccionar factura o recibo</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG o PNG</p>
              </label>
              {file && <p className="text-sm mt-3 font-medium">{file.name}</p>}
            </div>
            {file && (
              <Button onClick={handleExtractFromFile} disabled={extracting} className="w-full">
                {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Extraer datos con IA
              </Button>
            )}
          </TabsContent>

          <TabsContent value="manual" className="pt-4" />
        </Tabs>

        <div className="space-y-4">
          <div>
            <Label>Descripción *</Label>
            <Input value={form.descripcion} onChange={e => update('descripcion', e.target.value)} placeholder="Ej: Compra de materiales" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monto *</Label>
              <Input type="number" value={form.monto} onChange={e => update('monto', e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => update('fecha', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <Select value={form.categoria} onValueChange={v => update('categoria', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Proveedor</Label>
              <Input value={form.proveedor} onChange={e => update('proveedor', e.target.value)} placeholder="Nombre" />
            </div>
          </div>
          <div>
            <Label>Nro. Factura/Recibo</Label>
            <Input value={form.numero_factura} onChange={e => update('numero_factura', e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <Label>Forma de pago</Label>
            <Select value={form.forma_pago} onValueChange={v => update('forma_pago', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Efectivo">Efectivo (Caja)</SelectItem>
                <SelectItem value="Transferencia">Transferencia (Banco)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {campamentos.length > 0 && (
            <div>
              <Label>Asociar a campamento (opcional)</Label>
              <Select
                value={form.campamento_id || 'ninguno'}
                onValueChange={v => update('campamento_id', v === 'ninguno' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Sin campamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Sin campamento</SelectItem>
                  {campamentos.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {actividades.length > 0 && (
            <div>
              <Label>Asociar a actividad económica (opcional)</Label>
              <Select
                value={form.actividad_id || 'ninguna'}
                onValueChange={v => update('actividad_id', v === 'ninguna' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Sin actividad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Sin actividad</SelectItem>
                  {actividades.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Observaciones</Label>
            <Textarea value={form.observaciones} onChange={e => update('observaciones', e.target.value)} placeholder="Opcional" className="h-20" />
          </div>
          {tab === 'manual' && (
            <div>
              <Label>Adjuntar archivo</Label>
              <div className="flex gap-2 mt-1">
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files[0])} />
                {file && !form.archivo_url && (
                  <Button variant="outline" size="sm" onClick={handleFileUpload} disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                )}
              </div>
              {form.archivo_url && <p className="text-xs text-green-600 mt-1">✓ Archivo adjuntado</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.descripcion || !form.monto}>{isEditing ? 'Actualizar' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}