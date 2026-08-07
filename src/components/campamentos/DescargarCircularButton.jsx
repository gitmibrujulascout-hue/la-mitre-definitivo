import React from 'react';
import { FileText } from 'lucide-react';

export default function DescargarCircularButton({ campamento, variant = 'default' }) {
  const url = campamento?.circular_url;
  if (!url) return null;

  if (variant === 'icon') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:text-primary/80 p-1"
        title="Descargar circular / info del campamento"
      >
        <FileText className="w-3.5 h-3.5" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 mt-1.5"
    >
      <FileText className="w-3.5 h-3.5" />
      Descargar circular
    </a>
  );
}