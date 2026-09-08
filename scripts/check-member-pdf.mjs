import fs from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pdfRows } from '../src/services/access/memberImport.js';
const task=getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2])),isEvalSupported:false});
const pdf=await task.promise;
const lines=[];
for(let n=1;n<=pdf.numPages;n++) {
  const content=await (await pdf.getPage(n)).getTextContent();
  const groups=new Map();
  for(const item of content.items) {
    if(!('str' in item)) continue;
    const y=Math.round(item.transform[5]*2)/2;
    if(!groups.has(y)) groups.set(y,[]);
    groups.get(y).push(item);
  }
  for(const [,items] of [...groups.entries()].sort((a,b)=>b[0]-a[0])) lines.push(items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str).join(' '));
}
console.log(JSON.stringify({pages:pdf.numPages,detected:pdfRows(lines).length}));
await task.destroy();
