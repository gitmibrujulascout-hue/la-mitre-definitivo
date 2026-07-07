// Mantiene una única referencia a la ventana de WhatsApp a nivel de módulo,
// persistiendo entre navegación de componentes para reutilizar la misma pestaña.
let waWindow = null;

export function openWhatsApp(url) {
  if (waWindow && !waWindow.closed) {
    waWindow.location.href = url;
    waWindow.focus();
  } else {
    waWindow = window.open(url, 'whatsapp');
  }
}