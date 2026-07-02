import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Galería de imágenes de un producto con navegación y lightbox.
 * @param {string[]} imagenes - Array de URLs de imágenes
 * @param {string} nombre - Nombre del producto (alt text)
 * @param {string} className - Clases adicionales para el contenedor
 * @param {string} height - Clase de altura (ej: 'h-32', 'h-48')
 */
export default function ProductoGaleria({ imagenes = [], nombre = '', className = '', height = 'h-32' }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (!imagenes || imagenes.length === 0) {
    return (
      <div className={cn('w-full flex items-center justify-center bg-muted', height, className)}>
        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
      </div>
    );
  }

  if (imagenes.length === 1) {
    return (
      <>
        <img
          src={imagenes[0]}
          alt={nombre}
          className={cn('w-full object-cover cursor-pointer', height, className)}
          onClick={() => setLightbox(true)}
        />
        {lightbox && (
          <Lightbox url={imagenes[0]} alt={nombre} onClose={() => setLightbox(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className={cn('relative group', className)}>
        <img
          src={imagenes[activeIdx]}
          alt={`${nombre} ${activeIdx + 1}`}
          className={cn('w-full object-cover cursor-pointer', height)}
          onClick={() => setLightbox(true)}
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setActiveIdx(i => (i - 1 + imagenes.length) % imagenes.length); }}
          className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setActiveIdx(i => (i + 1) % imagenes.length); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
          {activeIdx + 1}/{imagenes.length}
        </span>
        <div className="flex gap-1 p-1 bg-muted/50 overflow-x-auto">
          {imagenes.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${nombre} thumb ${i + 1}`}
              className={cn(
                'w-10 h-10 object-cover rounded cursor-pointer border-2 shrink-0',
                i === activeIdx ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100'
              )}
              onClick={() => setActiveIdx(i)}
            />
          ))}
        </div>
      </div>
      {lightbox && (
        <Lightbox url={imagenes[activeIdx]} alt={`${nombre} ${activeIdx + 1}`} onClose={() => setLightbox(false)} />
      )}
    </>
  );
}

function Lightbox({ url, alt, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={onClose}>
        <X className="w-8 h-8" />
      </button>
      <img src={url} alt={alt} className="max-w-full max-h-[90vh] object-contain rounded-lg" />
    </div>
  );
}