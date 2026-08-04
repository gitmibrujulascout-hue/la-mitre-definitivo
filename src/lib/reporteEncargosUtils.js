// Lógica compartida para los reportes de pre-encargos de la tienda.

export const ESTADOS_ACTIVOS = ['Pendiente', 'Confirmado'];

export function filtrarEncargos(encargos, filtro) {
  if (filtro === 'todos') return encargos;
  if (filtro === 'activos') return encargos.filter(e => ESTADOS_ACTIVOS.includes(e.estado));
  return encargos.filter(e => e.estado === filtro);
}

// Agrupa por producto × talle → cantidad total (para pedir al proveedor).
export function buildPedidoProveedor(encargos) {
  const map = {};
  encargos.forEach(e => {
    if (!map[e.producto_nombre]) map[e.producto_nombre] = { talles: {}, total: 0 };
    const talle = e.talle || '_sin_talle_';
    map[e.producto_nombre].talles[talle] = (map[e.producto_nombre].talles[talle] || 0) + (e.cantidad || 0);
    map[e.producto_nombre].total += (e.cantidad || 0);
  });
  const todosTalles = new Set();
  Object.values(map).forEach(p => Object.keys(p.talles).forEach(t => todosTalles.add(t)));
  const talles = Array.from(todosTalles).sort((a, b) => {
    if (a === '_sin_talle_') return 1;
    if (b === '_sin_talle_') return -1;
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b, 'es');
  });
  return { map, talles };
}

// Agrupa por beneficiario con sus items (para armar la lista de entrega interna).
export function buildListaEntrega(encargos) {
  const porBen = {};
  encargos.forEach(e => {
    const key = e.beneficiario_id || e.beneficiario_nombre;
    if (!porBen[key]) porBen[key] = { nombre: e.beneficiario_nombre, items: [] };
    porBen[key].items.push(e);
  });
  return Object.values(porBen).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}