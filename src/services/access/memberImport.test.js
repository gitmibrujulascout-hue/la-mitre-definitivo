import test from 'node:test';
import assert from 'node:assert/strict';
import { rowsToMembers, validateMembers, pdfRows, pdfTable } from './memberImport.js';
test('reads all 144 rows with contact aliases and dates', () => {
  const rows = [['Nombre','Documento','Celular','Fecha Nacimiento'], ...Array.from({length:144},(_,i)=>['Ficticio',String(99000000+i),'123',new Date('2014-05-12T00:00:00Z')])];
  const result=rowsToMembers(rows);
  assert.equal(result.length,144);
  assert.equal(result[0].telefono_contacto,'123');
  assert.equal(result[0].fecha_nacimiento,'2014-05-12');
});
test('rejects incomplete extraction and duplicate documents', () => {
  assert.throws(()=>validateMembers([{nombre:'Ficticio',dni:'99000001'}],['99000001','99000002']));
  assert.throws(()=>rowsToMembers([['Nombre','DNI'],['Uno','99000001'],['Dos','99000001']]));
});
test('PDF recognizes adjoining name and document and rejects unrecognized layout', () => {
  assert.equal(pdfRows(['DNI 99000001Ficticio','DNI 99000002 Otro']).length,2);
  assert.throws(()=>pdfRows(['sin documento']));
});
test('PDF table separates document and name merged by the PDF generator', () => {
  const item=(str,x,y)=>({str,transform:[1,0,0,1,x,y]});
  const result=pdfTable([item('Tipo Documento',0,20),item('Documento',40,20),item('Nombre',80,20),item('DNI',0,10),item('99000001 Persona ficticia',45,10)]);
  assert.equal(result[0].dni,'99000001');
  assert.equal(result[0].nombre,'Persona ficticia');
});
