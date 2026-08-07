import React from 'react';
import { FileDown } from 'lucide-react';
import { generarAutorizacionPDF } from '@/lib/autorizacionPdf';

export default function DescargarAutorizacionButton({ campamento, beneficiario, variant = 'default' }) {
  const handle = () => generarAutorizacionPDF(campamento, beneficiario);

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handle}
        className="text-primary hover:text-primary/80 p-1"
        title="Descargar autorización"
      >
        <FileDown className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 mt-1.5"
    >
      <FileDown className="w-3.5 h-3.5" />
      Descargar autorización
    </button>
  );
}