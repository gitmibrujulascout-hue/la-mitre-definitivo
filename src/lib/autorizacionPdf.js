import { jsPDF } from 'jspdf';

const fmtFecha = (f) => {
  if (!f) return '';
  try {
    const [y, m, d] = f.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return f;
  }
};

export function generarAutorizacionPDF(campamento, beneficiario) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 50;
  const RW = W - M * 2;
  let y = 55;

  const ensureSpace = (needed) => {
    if (y + needed > H - M) {
      doc.addPage();
      y = M;
    }
  };

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('AUTORIZACIÓN PARA PARTICIPACIÓN EN CAMPAMENTO', W / 2, y, { align: 'center' });
  y += 14;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Grupo Scout Bartolomé Mitre', W / 2, y, { align: 'center' });
  y += 16;
  doc.setDrawColor(180);
  doc.line(M, y, W - M, y);
  y += 20;

  // Datos del campamento
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Datos del campamento', M, y);
  y += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const campData = [
    `Nombre: ${campamento.nombre || ''}`,
    `Fechas: ${fmtFecha(campamento.fecha_inicio)}${campamento.fecha_fin ? ` a ${fmtFecha(campamento.fecha_fin)}` : ''}`,
    `Ubicación: ${campamento.ubicacion || ''}`,
  ];
  campData.forEach((l) => { doc.text(l, M, y); y += 14; });
  y += 10;

  // Texto general de la autorización
  if (campamento.autorizacion_texto) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Autorización', M, y);
    y += 15;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const paras = String(campamento.autorizacion_texto).split('\n').filter(Boolean);
    paras.forEach((p) => {
      const lines = doc.splitTextToSize(p, RW);
      ensureSpace(lines.length * 13 + 5);
      doc.text(lines, M, y);
      y += lines.length * 13 + 5;
    });
    y += 10;
  }

  // Datos del menor (pre-llenado)
  ensureSpace(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Datos del/la menor', M, y);
  y += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(`Apellido y nombre: ${beneficiario?.nombre || ''}`, M, y); y += 14;
  doc.text(`DNI: ${beneficiario?.dni || ''}`, M, y); y += 22;

  // Campos en blanco para el adulto responsable
  const fieldLine = (label) => {
    ensureSpace(24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const labelW = doc.getTextWidth(label);
    doc.text(label, M, y);
    doc.setDrawColor(140);
    doc.line(M + labelW + 6, y - 2, W - M, y - 2);
    y += 22;
  };
  fieldLine('Apellido y nombre del adulto responsable:');
  fieldLine('DNI del adulto responsable:');
  fieldLine('Vínculo con el/la menor (padre/madre/tutor/a):');
  fieldLine('Teléfono de contacto:');

  y += 6;
  fieldLine('Lugar y fecha de firma:');

  // Firma
  y += 14;
  ensureSpace(30);
  doc.setDrawColor(140);
  const sigX = W - M - 200;
  doc.line(sigX, y, W - M, y);
  doc.setFontSize(9.5);
  doc.text('Firma del adulto responsable', sigX, y + 12);

  const nombre = (beneficiario?.nombre || campamento.nombre || 'campamento')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
  doc.save(`Autorizacion_${nombre}.pdf`);
}