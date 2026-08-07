import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// URL del PDF oficial de Scouts Argentina (no se modifica, sólo se superponen datos).
const PDF_URL = 'https://media.base44.com/files/public/69f1ed5d29db0dc5bc7e0ef8/9257f6412_AUTORIZACINGRUPO.pdf';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Carga el PDF oficial y superpone (sin editarlo) los datos que conocemos:
 * nombre/DNI/nacimiento del menor, fechas y lugar del campamento, y grupo/zona/distrito.
 * Los campos del adulto quedan en blanco para completar a mano.
 */
export async function generarAutorizacionPDF(campamento, beneficiario) {
  const resp = await fetch(PDF_URL);
  if (!resp.ok) throw new Error('No se pudo descargar el formulario oficial.');
  const bytes = await resp.arrayBuffer();

  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const page = doc.getPages()[0];
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const SZ = 10;
  const black = rgb(0, 0, 0);
  const draw = (text, x, y, size) => {
    if (!text || text === '' || x == null || y == null) return;
    page.drawText(String(text), { x, y, size: size || SZ, font, color: black });
  };

  const b = beneficiario || {};
  const c = campamento || {};

  // Nombre del menor (línea "MENOR (3) ....")
  draw(b.nombre, 215, 562);

  // Nacimiento del menor (línea "nacido/a el [dia] de [mes] de [anio] y DNI [dni]")
  if (b.fecha_nacimiento) {
    const [yN, mN, dN] = b.fecha_nacimiento.split('-');
    draw(dN, 208, 548);
    draw(MESES[parseInt(mN, 10) - 1], 236, 548);
    draw(yN, 342, 548);
  }
  draw(b.dni, 417, 548);

  // Fechas del campamento:
  //   - "desde el día ____" : la línea punteada del inicio de la segunda línea (x~75, y=509)
  //   - "Hasta el día ____" : justo después de la etiqueta "Hasta el día" (x~326, y=509)
  const fmt = (f) => {
    if (!f) return null;
    const [yF, mF, dF] = f.split('-');
    return `${parseInt(dF, 10)} de ${MESES[parseInt(mF, 10) - 1]} de ${yF}`;
  };
  draw(fmt(c.fecha_inicio), 75, 509, 9);
  draw(fmt(c.fecha_fin || c.fecha_inicio), 411, 509, 8.5);

  // Lugar del campamento (línea "ubicado en ....", línea punteada larga)
  draw(c.ubicacion, 150, 495, 9);

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const nombre = (b.nombre || c.nombre || 'campamento').replace(/[^\w\s]/g, '').replace(/\s+/g, '_');
  a.download = `Autorizacion_${nombre}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}