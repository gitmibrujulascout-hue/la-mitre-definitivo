// Utilidades para cálculo de stock disponible en la tienda.
// Modelo: stock_por_talle = stock físico (lo que hay en el inventario).
// stock_disponible = físico - reservas activas (pre-encargos Pendiente/Confirmado no entregados ni cancelados).

const ESTADOS_RESERVA = ['Pendiente', 'Confirmado'];

export function getReservasPorTalle(preEncargos, productoId) {
  const activas = preEncargos.filter(e => e.producto_id === productoId && ESTADOS_RESERVA.includes(e.estado));
  const reservas = {};
  activas.forEach(e => {
    const t = e.talle || '_sin_talle';
    reservas[t] = (reservas[t] || 0) + (e.cantidad || 0);
  });
  return reservas;
}

export function getStockDisponiblePorTalle(producto, preEncargos) {
  const reservas = getReservasPorTalle(preEncargos, producto.id);
  if (producto.tiene_talles) {
    const stock = {};
    (producto.talles || []).forEach(t => {
      stock[t] = (producto.stock_por_talle?.[t] || 0) - (reservas[t] || 0);
    });
    return stock;
  }
  return { _sin_talle: (producto.stock || 0) - (reservas._sin_talle || 0) };
}

export function getStockDisponibleTotal(producto, preEncargos) {
  const stock = getStockDisponiblePorTalle(producto, preEncargos);
  return Object.values(stock).reduce((s, v) => s + Math.max(0, v), 0);
}

export function getStockFisicoTotal(producto) {
  if (producto.tiene_talles) {
    return Object.values(producto.stock_por_talle || {}).reduce((s, v) => s + (v || 0), 0);
  }
  return producto.stock || 0;
}

export function getReservasTotal(producto, preEncargos) {
  const reservas = getReservasPorTalle(preEncargos, producto.id);
  return Object.values(reservas).reduce((s, v) => s + v, 0);
}