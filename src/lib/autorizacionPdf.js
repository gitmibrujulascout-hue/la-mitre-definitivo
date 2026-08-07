import { jsPDF } from 'jspdf';

const fmt = (f) => {
  if (!f) return '';
  try { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}`; } catch { return f; }
};

const fmtDia = (f) => {
  if (!f) return '';
  try { const [, , d] = f.split('-'); return d; } catch { return ''; }
};
const fmtMes = (f) => {
  if (!f) return '';
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  try { const [, m] = f.split('-'); return meses[parseInt(m, 10) - 1] || ''; } catch { return ''; }
};
const fmtAnio = (f) => {
  if (!f) return '';
  try { return f.split('-')[0]; } catch { return ''; }
};

// Dibuja un campo rellenable: etiqueta + línea de puntos hasta cierto x final
const puntos = (doc, texto, x, y, anchoMax) => {
  const tw = doc.getTextWidth(texto);
  const disponible = anchoMax - x - tw;
  if (disponible > 0) {
    const dotW = doc.getTextWidth('.');
    const ndots = Math.floor(disponible / dotW);
    return texto + '.'.repeat(ndots);
  }
  return texto;
};

export function generarAutorizacionPDF(campamento, beneficiario) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();   // 595
  const H = doc.internal.pageSize.getHeight();  // 842
  const ML = 45;
  const MR = W - 45;
  const TW = MR - ML;
  let y = 38;

  const nl = (n = 1) => { y += n; };
  const ensureSpace = (h) => { if (y + h > H - 50) { doc.addPage(); y = 45; } };

  // ── ENCABEZADO (logo textual) ──────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 102, 180);
  doc.text('Autorización de Padres / Madres / Tutores', ML + 2, y);
  nl(14);
  doc.text('para Salidas, Acantonamientos y/o Campamentos', ML + 2, y);
  nl(11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80);
  doc.text('Planilla Versión: 07-21', ML + 2, y);
  nl(10);
  doc.text('www.scouts.org.ar', ML + 2, y);
  nl(10);

  // Línea separadora
  doc.setDrawColor(0, 102, 180);
  doc.setLineWidth(1.2);
  doc.line(ML, y, MR, y);
  nl(3);
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 102, 180);
  doc.line(ML, y, MR, y);
  nl(14);

  // ── TÍTULO PRINCIPAL ───────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text('AUTORIZACIÓN DE PADRES / MADRES / TUTORES', W / 2, y, { align: 'center' });
  nl(16);
  doc.text('PARA SALIDAS, ACANTONAMIENTOS Y/O CAMPAMENTOS', W / 2, y, { align: 'center' });
  nl(20);

  // ── CUERPO ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0);

  const FS = 10;
  const LH = 16; // line height

  // Datos pre-llenados del campamento
  const localidad   = campamento.ubicacion ? campamento.ubicacion.split(',')[0].trim() : '...................................';
  const partido     = campamento.ubicacion ? (campamento.ubicacion.split(',')[1] || '').trim() : '......................................';
  const provincia   = 'Córdoba'; // constante de tu grupo — podés parametrizar
  const diaFirma    = '......';
  const mesFirma    = '............................';
  const anioFirma   = new Date().getFullYear().toString();
  const diaDesde    = fmtDia(campamento.fecha_inicio);
  const mesDesde    = fmtMes(campamento.fecha_inicio);
  const anioDesde   = fmtAnio(campamento.fecha_inicio);
  const diaHasta    = fmtDia(campamento.fecha_fin || campamento.fecha_inicio);
  const mesHasta    = fmtMes(campamento.fecha_fin || campamento.fecha_inicio);
  const anioHasta   = fmtAnio(campamento.fecha_fin || campamento.fecha_inicio);
  const lugarCamp   = campamento.ubicacion || '...................................';
  const numGrupo    = '377';
  const nombreGrupo = 'Bartolomé Mitre';
  const numDistrito = '5';
  const numZona     = '42';

  const nombreMenor = beneficiario?.nombre || '...............................................';
  const dniMenor    = beneficiario?.dni || '......................';
  const nacMenor    = beneficiario?.fecha_nacimiento
    ? (() => { const [y2,m2,d2] = beneficiario.fecha_nacimiento.split('-'); return `${d2} de ${fmtMes(beneficiario.fecha_nacimiento)} de ${y2}`; })()
    : '...... de ................................ de ..........';

  // Función para texto mixto (negrita para datos pre-llenados)
  const mixLine = (parts) => {
    // parts: [{text, bold}]
    let cx = ML;
    parts.forEach(({ text, bold }) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.text(text, cx, y);
      cx += doc.getTextWidth(text);
    });
    doc.setFont('helvetica', 'normal');
  };

  const blank = (n) => ' '.repeat(n);

  // Línea 1: localidad, partido, provincia
  mixLine([
    { text: 'En la localidad de ' },
    { text: localidad, bold: true },
    { text: ', partido / departamento de ' },
    { text: partido || '..............................', bold: !!partido },
    { text: ' de la' },
  ]);
  nl(LH);
  mixLine([
    { text: 'provincia de ' },
    { text: provincia, bold: true },
    { text: ', a los ' },
    { text: diaFirma },
    { text: ' días del mes de ' },
    { text: mesFirma },
    { text: ' del año ' },
    { text: anioFirma, bold: true },
    { text: ',' },
  ]);
  nl(LH);

  // Línea: yo (1) ...
  mixLine([
    { text: 'yo ¹ ' },
    { text: '...........................................................................', },
    { text: ' de nacionalidad ' },
    { text: '................................,' },
    { text: ' nacido/a él ...... de' },
  ]);
  nl(LH);
  mixLine([
    { text: '........................ de .............. DNI …............................. Teléfono: ……………….............................., y con domicilio' },
  ]);
  nl(LH);
  mixLine([
    { text: 'en......................................................................................................................................................................................' },
    { text: ' en mi' },
  ]);
  nl(LH);
  mixLine([
    { text: 'carácter de ² ............................................................ OTORGO AUTORIZACIÓN PARA QUE EL / LA' },
  ]);
  nl(LH);

  // Menor — pre-llenado
  mixLine([
    { text: 'MENOR ³ ' },
    { text: nombreMenor, bold: true },
    { text: ', de nacionalidad ....................................,...' },
  ]);
  nl(LH);
  mixLine([
    { text: 'nacido/a el ' },
    { text: nacMenor, bold: !!beneficiario?.fecha_nacimiento },
    { text: ' y DNI ' },
    { text: dniMenor, bold: !!beneficiario?.dni },
    { text: ', con domicilio en' },
  ]);
  nl(LH);
  mixLine([
    { text: '..............................................................................................................................................., para que realice la' },
  ]);
  nl(LH);

  // Salida / Campamento — pre-llenado
  doc.setFont('helvetica', 'bold');
  doc.text('SALIDA** / ACANTONAMIENTO/ CAMPAMENTO', ML, y);
  doc.setFont('helvetica', 'normal');
  const tacharX = ML;
  // Tachamos "SALIDA**" y "ACANTONAMIENTO"
  const wSalida = doc.getTextWidth('SALIDA**');
  const wBarra = doc.getTextWidth(' / ');
  const wAcant = doc.getTextWidth('ACANTONAMIENTO');
  doc.setLineWidth(0.6);
  doc.setDrawColor(0);
  doc.line(tacharX, y - 2, tacharX + wSalida, y - 2);
  doc.line(tacharX + wSalida + wBarra, y - 2, tacharX + wSalida + wBarra + wAcant, y - 2);
  doc.setLineWidth(0.4);

  let cx2 = ML + doc.getTextWidth('SALIDA** / ACANTONAMIENTO/ CAMPAMENTO');
  doc.setFont('helvetica', 'normal');
  doc.text(' (tachar lo que no corresponda) desde el día', cx2, y);
  nl(LH);

  mixLine([
    { text: fmt(campamento.fecha_inicio), bold: true },
    { text: ' Hasta el día ' },
    { text: fmt(campamento.fecha_fin || campamento.fecha_inicio), bold: true },
    { text: ', en el lugar' },
  ]);
  nl(LH);
  mixLine([
    { text: 'ubicado en ' },
    { text: lugarCamp, bold: true },
    { text: ', acompañado de' },
  ]);
  nl(LH);
  mixLine([
    { text: 'sus educadores/as pertenecientes al Grupo Scout N° ' },
    { text: numGrupo, bold: true },
    { text: ' Nombre ' },
    { text: nombreGrupo, bold: true },
  ]);
  nl(LH);
  mixLine([
    { text: 'del Distrito N° ' },
    { text: numDistrito, bold: true },
    { text: ' de la Zona ' },
    { text: numZona, bold: true },
    { text: ' de Scouts de Argentina Asociación Civil. ---------------------------------' },
  ]);
  nl(LH + 4);

  // Párrafo de autorizaciones adicionales
  const parrafo = 'Asimismo, doy autorización: 1) Para que los/las responsables de las actividades tomen, en caso de accidente o enfermedad todas las medidas necesarias para salvaguardar la integridad y la salud del / la menor. 2) Para realizar cualquier intervención quirúrgica de urgencia que así lo requiera la integridad y la salud del / la menor, 3) Que el menor sea transportado por la Asociación desde y hasta el lugar donde se realice la actividad autorizada por el medio de transporte que decida la Institución, dando conformidad para que se realicen los trámites y gestiones inherentes a cada viaje, ante las autoridades pertinentes y empresas de transporte, comprometiéndome en caso de revocación a hacerlo saber a las autoridades correspondientes y por escrito. -------------------------------------------------------------------------------------------------';
  const parrafoLines = doc.splitTextToSize(parrafo, TW);
  ensureSpace(parrafoLines.length * 13 + 30);
  doc.setFontSize(9.5);
  doc.text(parrafoLines, ML, y);
  y += parrafoLines.length * 13;
  nl(24);

  // Firma del responsable
  doc.setFontSize(10);
  doc.text('Firma: ...………………………………….', W / 2, y, { align: 'center' });
  nl(22);

  // Línea divisoria
  doc.setLineWidth(0.8);
  doc.setDrawColor(0);
  doc.line(ML, y, MR, y);
  nl(14);

  // ── AVAL ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('AVAL DE LOS RESPONSABLES SCOUTS (4)', W / 2, y, { align: 'center' });
  nl(14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const avalText = 'Certifico que el/la Menor registrado/a en la categoría de Beneficiario, posee el Legajo Personal completo según el capitulo 4, del Manual General de Normas de SAAC y que la persona que está otorgando autorización tiene su firma registrada en la "AUTORIZACIÓN DE INGRESO DE NIÑOS, NIÑAS Y JÓVENES MENORES DE 18 AÑOS".-';
  const avalLines = doc.splitTextToSize(avalText, TW);
  doc.text(avalLines, ML, y);
  y += avalLines.length * 13;
  nl(14);

  // Campos de aval con líneas
  const avalFields = [
    'Firma:',
    'Aclaración:',
    'DNI:',
    'Función en el Grupo Scout:',
  ];
  avalFields.forEach((label) => {
    const lw = doc.getTextWidth(label);
    doc.text(label, ML + 50, y);
    doc.setDrawColor(120);
    doc.line(ML + 50 + lw + 6, y - 2, ML + 50 + lw + 6 + 200, y - 2);
    nl(16);
  });

  nl(14);

  // ── NOTAS AL PIE ──────────────────────────────────────────────────────────
  doc.setLineWidth(0.4);
  doc.setDrawColor(0);
  doc.line(ML, y, ML + 120, y);
  nl(10);
  doc.setFontSize(8);
  const notas = [
    '¹ Nombre y apellido completo de quien firma la autorización, tal como figura en el DNI',
    '² Hay que hacer figurar el carácter en el cual se autoriza al menor: padre/ madre/ tutor/ guardador/ persona que ejerce la tenencia judicial del menor',
    '³ Nombre y apellido del menor, tal como figura en el DNI',
  ];
  notas.forEach((n) => {
    const ls = doc.splitTextToSize(n, TW);
    ensureSpace(ls.length * 11 + 4);
    doc.text(ls, ML, y);
    y += ls.length * 11 + 2;
  });

  nl(12);

  // ── PIE DE PÁGINA ─────────────────────────────────────────────────────────
  doc.setLineWidth(1);
  doc.setDrawColor(0, 102, 180);
  doc.line(ML, y, MR, y);
  nl(2);
  doc.setLineWidth(0.4);
  doc.line(ML, y, MR, y);
  nl(10);
  doc.setFontSize(7.5);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.text('MIEMBRO DE LA ORGANIZACIÓN MUNDIAL DEL MOVIMIENTO SCOUT', ML, y);
  nl(10);
  doc.setFont('helvetica', 'italic');
  doc.text('Scouts de Argentina Asociación Civil', ML, y);
  doc.setFont('helvetica', 'normal');
  doc.text(', es una organización sin fines de lucro, con Personería', ML + doc.getTextWidth('Scouts de Argentina Asociación Civil'), y);
  nl(9);
  doc.text('Jurídica Nacional N° 1645416 – Res IGJ N° 999 del 24 de septiembre de 1998.', ML, y);
  nl(9);
  doc.text('Sede Nacional: Libertad 1282 – CABA – C1012AAZ – Argentina – Tel: +54-11-4811-0185', ML, y);
  nl(9);
  doc.text('CUIT 30-69732250-3 – IVA Exento', ML, y);

  const nombre = (beneficiario?.nombre || campamento.nombre || 'campamento')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
  doc.save(`Autorizacion_${nombre}.pdf`);
}