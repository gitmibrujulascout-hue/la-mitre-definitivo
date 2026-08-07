import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Landmark, Download, Trash2, FileText } from 'lucide-react';
import { formatMoney } from '@/lib/ramaUtils';
import { toast } from 'sonner';

export default function RendicionesList({ anio }) {
  const queryClient = useQueryClient();
  const { data: rendiciones = [], isLoading } = useQuery({
    queryKey: ['rendiciones-afiliacion'],
    queryFn: () => base44.entities.RendicionAfiliacion.list('-fecha', 50),
  });

  const rendicionesAnio = rendiciones.filter(r => Number(r.anio) === Number(anio));

  const deleteMutation = useMutation({
    mutationFn: async (r) => {
      // Revertir movimientos de caja y borrar la rendición
      await base44.entities.MovimientoBanco.deleteMany({ referencia_id: r.id, origen: 'Afiliación' });
      await base44.entities.RendicionAfiliacion.delete(r.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rendiciones-afiliacion'] });
      queryClient.invalidateQueries({ queryKey: ['movimientos_banco'] });
      toast.success('Rendición eliminada y movimientos revertidos');
    }
  });

  const handleDelete = (r) => {
    if (window.confirm(`¿Eliminar la rendición del ${r.fecha} por ${formatMoney(r.monto_depositado)}? Se revertirán los movimientos de caja.`)) {
      deleteMutation.mutate(r);
    }
  };

  if (isLoading || rendicionesAnio.length === 0) return null;

  return (
    <Card className="overflow-hidden mt-6">
      <div className="p-4 border-b bg-muted/30">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" />
          Rendiciones a Scout Argentina — {anio}
        </h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Depositado</TableHead>
            <TableHead className="text-right">Recaudado</TableHead>
            <TableHead className="text-right">De caja común</TableHead>
            <TableHead>Comprobante</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rendicionesAnio.map(r => (
            <TableRow key={r.id}>
              <TableCell className="text-sm">{r.fecha}</TableCell>
              <TableCell className="text-right font-semibold text-red-600">{formatMoney(r.monto_depositado)}</TableCell>
              <TableCell className="text-right text-green-600">{formatMoney(r.monto_recaudado || 0)}</TableCell>
              <TableCell className="text-right">
                {(r.monto_faltante || 0) > 0
                  ? <span className="text-amber-600 font-medium">{formatMoney(r.monto_faltante)}</span>
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-sm">
                {r.archivo_url
                  ? <a href={r.archivo_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      <Download className="w-3 h-3" />{r.comprobante || 'Ver comprobante'}
                    </a>
                  : r.comprobante || <span className="text-muted-foreground text-xs inline-flex items-center gap-1"><FileText className="w-3 h-3" />Sin archivo</span>}
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}>
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}