import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { generarAutorizacionPDF } from '@/lib/autorizacionPdf';

export default function DescargarAutorizacionButton({ campamento, beneficiario, variant = 'default' }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await generarAutorizacionPDF(campamento, beneficiario);
    } catch (e) {
      alert('No se pudo generar la autorización: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const Icon = loading ? Loader2 : FileDown;
  const iconCls = 'w-3.5 h-3.5 ' + (loading ? 'animate-spin' : '');

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handle}
        disabled={loading}
        className="text-primary hover:text-primary/80 p-1"
        title="Descargar autorización"
      >
        <Icon className={iconCls} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 mt-1.5"
    >
      <Icon className={iconCls} />
      {loading ? 'Generando...' : 'Descargar autorización'}
    </button>
  );
}