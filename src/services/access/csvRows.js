export function csvRows(text) {
  text = text.replace(/^\uFEFF/, '');
  const parse = separator => {
    const rows = []; let row = []; let cell = ''; let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else if (quoted || cell === '') quoted = !quoted;
        else throw new Error('El CSV contiene comillas inválidas.');
      } else if (!quoted && ch === separator) { row.push(cell); cell = ''; }
      else if (!quoted && (ch === '\n' || ch === '\r')) {
        row.push(cell); rows.push(row); row = []; cell = '';
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else cell += ch;
      if (rows.length > 3001 || row.length > 100) throw new Error('El CSV supera 3000 personas o 100 columnas.');
    }
    if (quoted) throw new Error('El CSV contiene una celda con comillas sin cerrar.');
    if (cell || row.length) rows.push([...row, cell]);
    return rows;
  };
  const candidates = [',', ';', '\t'].map(separator => { try { return parse(separator); } catch { return null; } });
  const rows = candidates.filter(Boolean).sort((a, b) => (b[0]?.length || 0) - (a[0]?.length || 0))[0];
  if (!rows || rows[0]?.length < 2) throw new Error('No se pudo leer el CSV. Revisá el separador y las comillas.');
  const width = rows[0].length;
  if (rows.some(row => row.some(Boolean) && row.length !== width)) throw new Error('El CSV tiene filas con distinta cantidad de columnas.');
  return rows;
}
