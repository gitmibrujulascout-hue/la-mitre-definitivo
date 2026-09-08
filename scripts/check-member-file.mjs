import fs from 'node:fs';
import { extractMembers } from '../src/services/access/memberImport.js';
const path=process.argv[2];
const result=await extractMembers(new File([fs.readFileSync(path)],'members.xlsx'),()=>{throw new Error('Excel must not call AI');},()=>{});
console.log(JSON.stringify({records:result.length,uniqueDocuments:new Set(result.map(p=>p.dni)).size}));
