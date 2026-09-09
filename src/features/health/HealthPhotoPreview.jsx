import { useEffect,useState } from 'react';

export default function HealthPhotoPreview({files}){
  const [photos,setPhotos]=useState([]);
  useEffect(()=>{
    const next=files.filter(file=>file.type.startsWith('image/')).map(file=>URL.createObjectURL(file));setPhotos(next);
    return ()=>next.forEach(url=>URL.revokeObjectURL(url));
  },[files]);
  if(!photos.length)return null;
  return <details className="rounded border p-3"><summary className="min-h-11 cursor-pointer font-medium">Ver fotos originales para revisar</summary><div className="space-y-3">{photos.map((url,index)=><img key={url} src={url} alt={`Página fotografiada ${index+1}`} className="w-full h-auto rounded"/>)}</div></details>;
}
