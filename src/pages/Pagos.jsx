import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Users, Tent } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RamaBadge from '@/components/shared/RamaBadge';
import PagoForm from '@/components/pagos/PagoForm';
import PagoMasivoDialog from '@/components/pagos/PagoMasivoDialog';
import PagoMasivoCampamentoDialog from '@/components/pagos/PagoMasivoCampamentoDialog';
import { formatMoney } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Pagos() {
  const [showForm, setShowForm] = useState(false);
  const [showMasivo, setShowMasivo] = useState(false);
  const [showMasivoCamp, setShowMasivoCamp] = useState(false);
  const queryClient = useQueryClient();

  const { data: pagos = [], isLoading } = useQuery({
    queryKey: ['pagos'],
    queryFn: () => base44.entities.Pago.list('-fecha_pago', 200),
  });

  const { data: beneficiarios = [] } = useQuery({
    queryKey: ['beneficiarios'],
    queryFn: () => base44.entities.Beneficiario.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Pago.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pagos'] }); toast.success('Pago eliminado'); },
  });

  const getBeneficiario = (id) => beneficiarios.find(b => b.id === id);

  return (
    <div>
      <PageHeader title="Pagos" description="Registro de cuotas mensuales">
        <Button variant="outline" onClick={() => setShowMasivoCamp(true)}><Tent className="w-4 h-4 mr-2" />Masivo campamento</Button>
        <Button variant="outline" onClick={() => setShowMasivo(true)}><Users className="w-4 h-4 mr-2" />Registro masivo</Button>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Registrar Pago</Button>
      </PageHeader>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Beneficiario</TableHead>
              <TableHead>Rama</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Forma de Pago</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : pagos.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay pagos registrados</TableCell></TableRow>
            ) : (
              pagos.map(p => {
                const ben = getBeneficiario(p.beneficiario_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.beneficiario_nombre}</TableCell>
                    <TableCell>{ben && <RamaBadge rama={ben.rama} />}</TableCell>
                    <TableCell>
                      {p.tipo_pago === 'Campamento'
                        ? `Camp: ${p.campamento_nombre || '—'}`
                        : `${(p.meses?.length ? p.meses.join(', ') : (p.mes || '—'))} ${p.anio}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.forma_pago === 'Subsidio del grupo' ? 'border-purple-300 bg-purple-50 text-purple-700' : ''}>{p.forma_pago}</Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-green-600">{formatMoney(p.monto)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{p.fecha_pago}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {showForm && <PagoForm open onClose={() => setShowForm(false)} beneficiarios={beneficiarios} />}
      {showMasivo && <PagoMasivoDialog open onClose={() => setShowMasivo(false)} beneficiarios={beneficiarios} />}
      {showMasivoCamp && <PagoMasivoCampamentoDialog open onClose={() => setShowMasivoCamp(false)} beneficiarios={beneficiarios} />}
    </div>
  );
}