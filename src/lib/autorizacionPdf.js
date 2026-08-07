import { jsPDF } from 'jspdf';

// ── Datos fijos del grupo (editá estos valores si cambian) ──────────────────
const GRUPO_NUM = '377';
const GRUPO_NOMBRE = 'Bartolomé Mitre';
const DISTRITO_NUM = '5';
const ZONA_NUM = '42';

const MESES_TXT = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const dots = (n) => '.'.repeat(Math.max(0, n));

const fechaPartes = (f) => {
  if (!f) return { dia: dots(6), mes: dots(20), anio: dots(6) };
  const [y, m, d] = f.split('-');
  return { dia: d, mes: MESES_TXT[parseInt(m, 10) - 1] || dots(20), anio: y };
};

export function generarAutorizacionPDF(campamento, beneficiario) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ML = 40;
  const MR = 40;
  const TW = W - ML - MR;
  let y = 40;

  const nl = (n) => { y += n; };
  const ensure = (h) => { if (y + h > H - 50) { doc.addPage(); y = 45; } };

  const FS = 9.5;
  const LH = 13;

  // ── Encabezado institucional ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 51, 102);
  doc.text('Autorización de Padres / Madres / Tutores', ML + 2, y);
  nl(12);
  doc.text('para Salidas, Acantonamientos y/o Campamentos', ML + 2, y);
  nl(11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text('Planilla Versión: 07-21', ML + 2, y);
  nl(9);
  doc.text('www.scouts.org.ar', ML + 2, y);
  nl(8);

  // doble línea divisoria
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(1);
  doc.line(ML, y, W - MR, y);
  nl(2);
  doc.setLineWidth(0.4);
  doc.line(ML, y, W - MR, y);
  nl(14);
  doc.setTextColor(0);

  // ── Título principal ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('AUTORIZACIÓN DE PADRES / MADRES / TUTORES', W / 2, y, { align: 'center' });
  nl(15);
  doc.text('PARA SALIDAS, ACANTONAMIENTOS Y/O CAMPAMENTOS', W / 2, y, { align: 'center' });
  nl(18);

  // ── Cuerpo: texto oficial verbatim con campos rellenados ────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FS);

  const nombreMenor = beneficiario?.nombre?.trim() || dots(45);
  const dniMenor = beneficiario?.dni?.trim() || dots(20);
  const nac = fechaPartes(beneficiario?.fecha_nacimiento);
  const desde = fechaPartes(campamento?.fecha_inicio);
  const hasta = fechaPartes(campamento?.fecha_fin || campamento?.fecha_inicio);
  const lugarCamp = campamento?.ubicacion?.trim() || dots(70);

  const cuerpo = [
    `En la localidad de ${dots(45)}, partido / departamento de ${dots(48)} de la`,
    `provincia de ${dots(43)}, a los ${dots(6)} días del mes de ${dots(26)} del año ${dots(6)},`,
    `yo (1) ${dots(48)} de nacionalidad ${dots(38)}, nacido/a él ${dots(7)} de`,
    `${dots(24)} de ${dots(14)} DNI ${dots(22)} Teléfono: ${dots(18)}, y con domicilio`,
    `en ${dots(110)} en mi`,
    `carácter de (2) ${dots(48)} OTORGO AUTORIZACIÓN PARA QUE EL / LA`,
    `MENOR (3) ${nombreMenor}, de nacionalidad ${dots(33)},`,
    `nacido/a el ${nac.dia} de ${nac.mes} de ${nac.anio} y DNI ${dniMenor}, con domicilio en`,
    `${dots(86)}, para que realice la`,
    `SALIDA / ACANTONAMIENTO/ CAMPAMENTO (tachar lo que no corresponda) desde el día`,
    `${desde.dia} de ${desde.mes} de ${desde.anio} Hasta el día ${hasta.dia} de ${hasta.mes} de ${hasta.anio}, en el lugar`,
    `ubicado en ${lugarCamp}, acompañado de`,
    `sus educadores/as pertenecientes al Grupo Scout N° ${GRUPO_NUM} Nombre ${GRUPO_NOMBRE}`,
    `del Distrito N° ${DISTRITO_NUM} de la Zona ${ZONA_NUM} de Scouts de Argentina Asociación Civil. ---------------------------------`,
  ];

  cuerpo.forEach((linea, i) => {
    const wrapped = doc.splitTextToSize(linea, TW);
    ensure(wrapped.length * LH + 2);
    const yLinea = y;
    doc.text(wrapped, ML, y);
    // Tachado de SALIDA y ACANTONAMIENTO en la línea 10 (índice 9) si no envolvió
    if (i === 9 && wrapped.length === 1) {
      doc.setFontSize(FS);
      const wSalida = doc.getTextWidth('SALIDA');
      const wBarra = doc.getTextWidth(' / ');
      const wAcant = doc.getTextWidth('ACANTONAMIENTO');
      doc.setLineWidth(0.6);
      doc.setDrawColor(0);
      doc.line(ML, yLinea - 3, ML + wSalida, yLinea - 3);
      const xAcant = ML + wSalida + wBarra;
      doc.line(xAcant, yLinea - 3, xAcant + wAcant, yLinea - 3);
      doc.setLineWidth(0.4);
    }
    y += wrapped.length * LH + 2;
  });

  nl(6);

  // ── Párrafo "Asimismo..." (verbatim) ────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FS);
  const asimismo = 'Asimismo, doy autorización: 1) Para que los/las responsables de las actividades tomen, en caso de accidente o enfermedad todas las medidas necesarias para salvaguardar la integridad y la salud del / la menor. 2) Para realizar cualquier intervención quirúrgica de urgencia que así lo requiera la integridad y la salud del / la menor, 3) Que el menor sea transportado por la Asociación desde y hasta el lugar donde se realice la actividad autorizada por el medio de transporte que decida la Institución, dando conformidad para que se realicen los trámites y gestiones inherentes a cada viaje, ante las autoridades pertinentes y empresas de transporte, comprometiéndome en caso de revocación a hacerlo saber a las autoridades correspondientes y por escrito. -------------------------------------------------------------------------------------------------';
  const asimismoLines = doc.splitTextToSize(asimismo, TW);
  ensure(asimismoLines.length * LH + 4);
  doc.text(asimismoLines, ML, y);
  y += asimismoLines.length * LH;
  nl(18);

  // ── Firma del adulto ────────────────────────────────────────────────────
  doc.setFontSize(FS);
  doc.text('Firma: ' + dots(50), ML, y);
  nl(24);

  // línea divisoria
  doc.setLineWidth(0.8);
  doc.line(ML, y, W - MR, y);
  nl(14);

  // ── AVAL DE LOS RESPONSABLES SCOUTS ─────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('AVAL DE LOS RESPONSABLES SCOUTS (4)', W / 2, y, { align: 'center' });
  nl(14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const aval = 'Certifico que el/la Menor registrado/a en la categoría de Beneficiario, posee el Legajo Personal completo según el capitulo 4, del Manual General de Normas de SAAC y que la persona que está otorgando autorización tiene su firma registrada en la “AUTORIZACIÓN DE INGRESO DE NIÑOS, NIÑAS Y JÓVENES MENORES DE 18 AÑOS”.-';
  const avalLines = doc.splitTextToSize(aval, TW);
  doc.text(avalLines, ML, y);
  y += avalLines.length * 12;
  nl(14);

  // Campos del aval con líneas
  doc.setFontSize(9);
  const avalCampo = (label, anchoLinea) => {
    doc.text(label, ML, y);
    const lw = doc.getTextWidth(label);
    doc.setDrawColor(120);
    doc.line(ML + lw + 6, y - 2, ML + lw + 6 + anchoLinea, y - 2);
  };
  avalCampo('Firma:', 150);
  let x1 = ML + doc.getTextWidth('Firma:') + 6 + 150 + 20;
  avalCampo2(doc, 'Aclaración:', x1, y, 150);
  nl(18);
  avalCampo('DNI:', 150);
  x1 = ML + doc.getTextWidth('DNI:') + 6 + 150 + 20;
  avalCampo2(doc, 'Función en el Grupo Scout:', x1, y, 150);
  nl(22);

  doc.setDrawColor(0);

  // ── Notas al pie (verbatim) ─────────────────────────────────────────────
  doc.setFontSize(7.5);
  const notas = [
    '1 Nombre y apellido completo de quien firma la autorización, tal como figura en el DNI',
    '2 Hay que hacer figurar el carácter en el cual se autoriza al menor: padre/ madre/ tutor/ guardador/ persona que ejerce la tenencia judicial del menor',
    '3 Nombre y apellido del menor, tal como figura en el DNI',
  ];
  notas.forEach((n) => {
    const ls = doc.splitTextToSize(n, TW);
    ensure(ls.length * 10 + 3);
    doc.text(ls, ML, y);
    y += ls.length * 10 + 2;
  });
  nl(8);

  // ── Pie institucional ───────────────────────────────────────────────────
  doc.setLineWidth(1);
  doc.setDrawColor(0, 51, 102);
  doc.line(ML, y, W - MR, y);
  nl(2);
  doc.setLineWidth(0.4);
  doc.line(ML, y, W - MR, y);
  nl(9);
  doc.setFontSize(7);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.text('MIEMBRO DE LA ORGANIZACIÓN MUNDIAL DEL MOVIMIENTO SCOUT', ML, y);
  nl(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Scouts de Argentina Asociación Civil', ML, y);
  const wSAAC = doc.getTextWidth('Scouts de Argentina Asociación Civil');
  doc.setFont('helvetica', 'normal');
  doc.text(', es una organización sin fines de lucro, con Personería', ML + wSAAC, y);
  nl(8);
  doc.text('Jurídica Nacional N° 1645416 – Res IGJ N° 999 del 24 de septiembre de 1998.', ML, y);
  nl(8);
  doc.text('Sede Nacional: Libertad 1282 – CABA – C1012AAZ – Argentina – Tel: +54-11-4811-0185', ML, y);
  nl(8);
  doc.text('CUIT 30-69732250-3 – IVA Exento', ML, y);

  const nombre = (beneficiario?.nombre || campamento?.nombre || 'campamento')
    .replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
  doc.save(`Autorizacion_${nombre}.pdf`);
}

// helper para segundo campo en la misma fila del aval
function avalCampo2(doc, label, x, y, anchoLinea) {
  doc.text(label, x, y);
  const lw = doc.getTextWidth(label);
  doc.setDrawColor(120);
  doc.line(x + lw + 6, y - 2, x + lw + 6 + anchoLinea, y - 2);
}