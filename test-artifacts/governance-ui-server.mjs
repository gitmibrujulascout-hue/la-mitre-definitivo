import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const root=process.cwd();
const server=await createServer({configFile:false,root,plugins:[react()],resolve:{alias:[...['@/api/supabaseClient','@/lib/AuthContext'].map(find=>({find,replacement:path.join(root,'test-artifacts/governance-ui-mock.js')})),{find:'@',replacement:path.join(root,'src')}]},server:{host:'127.0.0.1',port:5206,strictPort:true}});
await server.listen();console.log('Governance UI fixture: http://127.0.0.1:5206/test-artifacts/governance-ui.html');
