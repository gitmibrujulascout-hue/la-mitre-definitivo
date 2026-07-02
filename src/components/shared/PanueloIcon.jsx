import React from 'react';

const PANUELO_PROMESA_IMG = "https://media.base44.com/images/public/69f1ed5d29db0dc5bc7e0ef8/9f0e84abb_Gemini_Generated_Image_pm52inpm52inpm52.png";
const PANUELO_INVESTIDURA_IMG = "https://media.base44.com/images/public/69f1ed5d29db0dc5bc7e0ef8/030bc09bd_Gemini_Generated_Image_pm52inpm52inpm52-copia.png";
const PANUELO_PATURUZU_IMG = "https://media.base44.com/images/public/69f1ed5d29db0dc5bc7e0ef8/73289e913_Gemini_Generated_Image_pm52inpm52inpm52-copia2.png";

export const PANUELO_OPTIONS = [
  { value: '', label: 'Sin pañuelo', icon: null },
  { value: 'Promesa', label: 'Promesa', img: PANUELO_PROMESA_IMG },
  { value: 'Investidura', label: 'Investidura', img: PANUELO_INVESTIDURA_IMG },
  { value: 'Paturuzú', label: 'Paturuzú', img: PANUELO_PATURUZU_IMG },
];

export default function PanueloIcon({ estado, className = "w-4 h-4" }) {
  const opt = PANUELO_OPTIONS.find(p => p.value === estado);
  if (!opt) return null;
  if (opt.img) return <img src={opt.img} alt={opt.label} className={`${className} object-contain inline-block align-middle mix-blend-multiply`} />;
  if (opt.icon) { const Icon = opt.icon; return <Icon className={`${className} inline-block align-middle`} />; }
  return null;
}