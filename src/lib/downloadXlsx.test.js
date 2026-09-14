import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { buildXlsx, downloadXlsx } from './downloadXlsx.js';

test('Excel conserva columnas, tildes, DNI con ceros y montos; rechaza fórmulas externas',async()=>{
  const bytes=await buildXlsx([{Nombre:'Persona ficticia',DNI:'00123456',Monto:12.5,Texto:'=1+1'}],'Créditos',['Nombre','DNI','Monto','Texto']);
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
  const sheet=book.getWorksheet('Créditos');
  assert.equal(sheet.getCell('B2').value,'00123456');assert.equal(sheet.getCell('C2').value,12.5);assert.equal(sheet.getCell('D2').type,ExcelJS.ValueType.String);
  const empty=new ExcelJS.Workbook();await empty.xlsx.load(await buildXlsx([],'Vacío',['Nombre','DNI']));
  assert.equal(empty.getWorksheet('Vacío').getCell('B1').value,'DNI');
  await assert.rejects(buildXlsx([{Monto:{formula:'1+1'}}],'Reporte'));
});
test('descarga fallida libera el enlace y propaga el error para reintentar',async()=>{
  let removed=false;const original=globalThis.document;
  globalThis.document={body:{appendChild(){}},createElement(){return {click(){throw new Error('simulated download failure');},remove(){removed=true;}};}};
  try{await assert.rejects(downloadXlsx([{Nombre:'Ficticio'}],'Reporte','test.xlsx'));assert.equal(removed,true);}finally{globalThis.document=original;}
});
