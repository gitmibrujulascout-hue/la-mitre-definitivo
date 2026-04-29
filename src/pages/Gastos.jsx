import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ExternalLink, FileText } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import GastoForm from '@/components/gastos/GastoForm';
import { formatMoney } from '@/lib/ramaUtils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Gastos() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: gastos = [], isLoading } = useQuery({
    queryKey: ['gastos'],
    queryFn: () => base44.entities.Gasto.list('-created_date', 100),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.Gasto.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gastos'] }); toast.success('Gasto eliminado'); },
  });

  const totalGastos = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);

  return (
    <div>
      <PageHeader title="Gastos" description={`Total registrado: ${formatMoney(totalGastos)}`}>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Nuevo Gasto</Button>
      </PageHeader>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead className="hidden md:table-cell">Proveedor</TableHead>
              <TableHead>Archivo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : gastos.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay gastos registrados</TableCell></TableRow>
            ) : (
              gastos.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.descripcion}</TableCell>
                  <TableCell><Badge variant="secondary">{g.categoria || '—'}</Badge></TableCell>
                  <TableCell className="font-semibold text-red-500">{formatMoney(g.monto)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{g.fecha}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{g.proveedor || '—'}</TableCell>
                  <TableCell>
                    {g.archivo_url ? (
                      <a href={g.archivo_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="w-4 h-4 text-primary" />
                      </a>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(g.id)}>
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {showForm && <GastoForm open onClose={() => setShowForm(false)} />}
    </div>
  );
}