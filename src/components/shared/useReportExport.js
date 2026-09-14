import { useRef, useState } from 'react';
import { toast } from 'sonner';

export function useReportExport() {
  const [exporting, setExporting] = useState(false);
  const running = useRef(false);
  async function runExport(operation) {
    if (running.current) return;
    running.current = true;
    setExporting(true);
    const id = toast.loading('Preparando el archivo…');
    try {
      await operation();
      toast.success('Archivo listo. Revisá tus descargas.', { id });
    } catch {
      toast.error('No pudimos generar el archivo. Intentá nuevamente.', {
        id, duration: 10000, action: { label: 'Reintentar', onClick: () => runExport(operation) },
      });
    } finally {
      running.current = false;
      setExporting(false);
    }
  }
  return { exporting, runExport };
}
