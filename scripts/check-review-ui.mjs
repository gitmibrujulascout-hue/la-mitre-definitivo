import { createServer, preview } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';
import path from 'node:path';
import assert from 'node:assert/strict';

const source = `import React from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {BrowserRouter} from 'react-router-dom';
import {Toaster} from '/src/components/ui/sonner.jsx';
import Beneficiarios from '/src/pages/ReporteBeneficiarios.jsx';import Pagos from '/src/pages/ReportePagos.jsx';import Creditos from '/src/pages/ReporteCreditos.jsx';
import '/src/index.css';
const Page=location.search.includes('pagos')?Pagos:location.search.includes('creditos')?Creditos:Beneficiarios;
createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><Page/><Toaster/></BrowserRouter></QueryClientProvider>);`;
const mock = `const date=new Date().toISOString().slice(0,10),year=new Date().getFullYear();
const members=[{id:'00000000-0000-4000-8000-000000000001',nombre:'Persona ficticia',dni:'00123456',rama:'Tropa',tipo:'Beneficiario',activo:true}];
const payment=[{id:'p',beneficiario_id:members[0].id,beneficiario_nombre:'Persona ficticia',fecha_pago:date,anio:year,mes:'Septiembre',meses:['Septiembre'],monto:1234.56,tipo_pago:'Cuota',forma_pago:'Crédito actividad'}];
export const base44={entities:new Proxy({}, {get:(_,name)=>({list:async()=>name==='Beneficiario'?members:name==='Pago'?payment:[],filter:async()=>[]})})};`;
const fixture = {name:'review-fixture',resolveId(id){if(id==='review-api')return '\0review-api';},load(id){if(id==='\0review-api')return mock;},configureServer(server){server.middlewares.use('/__review.html',async(_req,res)=>{const html=await server.transformIndexHtml('/__review.html','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__review.jsx"></script></body></html>');res.setHeader('Content-Type','text/html');res.end(html);});server.middlewares.use('/__review.jsx',async(_req,res)=>{const result=await server.transformRequest('/__virtual_review.jsx');res.setHeader('Content-Type','text/javascript');res.end(result.code);});},transform(code,id){if(id.endsWith('/__virtual_review.jsx'))return code;}};
fixture.resolveId=(id)=>id==='review-api'?'\0review-api':['/__review.jsx','/__virtual_review.jsx'].includes(id)?path.resolve('__virtual_review.jsx'):null;
fixture.load=(id)=>id==='\0review-api'?mock:id.endsWith('/__virtual_review.jsx')?source:null;
const server=await createServer({configFile:false,root:process.cwd(),plugins:[fixture,react()],resolve:{alias:[{find:'@/api/base44Client',replacement:'review-api'},{find:'@',replacement:path.resolve('src')}]},server:{host:'127.0.0.1',port:5215,strictPort:true}});
await server.listen();
const browser=await chromium.launch(process.platform==='win32'?{channel:'msedge',headless:true}:{headless:true});
let production;
try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [360,768,1280]) for(const report of ['beneficiarios','pagos','creditos']) {
    await page.setViewportSize({width,height:950});
    await page.goto('http://127.0.0.1:5215/__review.html?'+report);
    await page.evaluate(dark=>document.documentElement.classList.toggle('dark',dark),width===768);
    const button=page.getByRole('button',{name:report==='beneficiarios'?'Exportar':report==='pagos'?'Exportar Excel facturación':'Excel',exact:true});
    await button.waitFor();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Excel')&&!b.disabled)||Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Exportar'&&!b.disabled));
    // Force one local download failure; the production hook must render retry.
    await page.evaluate(()=>{const create=URL.createObjectURL;let fail=true;URL.createObjectURL=function(...args){if(fail){fail=false;throw new Error('simulated');}return create.apply(this,args);};});
    await button.click();if(report==='beneficiarios')await page.getByRole('menuitem',{name:'Excel (.xlsx)'}).click();
    await page.getByText('No pudimos generar el archivo. Intentá nuevamente.',{exact:true}).waitFor();
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Reintentar',exact:true}).click();
    assert.match((await download).suggestedFilename(),/\.xlsx$/);
    await page.getByText('Archivo listo. Revisá tus descargas.',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,report+' overflow '+width);
    if(report==='beneficiarios' && width===1280){
      const pdf=page.waitForEvent('download');await button.click();await page.getByRole('menuitem',{name:'PDF',exact:true}).click();
      assert.match((await pdf).suggestedFilename(),/\.pdf$/);
    }
  }
  assert.deepEqual(errors,[]);
  production=await preview({preview:{host:'127.0.0.1',port:5216,strictPort:true}});
  const anonymous=await browser.newPage();
  await anonymous.route('https://**/*',route=>route.abort());
  for(const route of ['/beneficiarios','/app','/directorio-emergencias']) {
    await anonymous.goto('http://127.0.0.1:5216'+route);
    await anonymous.waitForURL('**/login');await anonymous.getByLabel('Contraseña',{exact:true}).waitFor();
  }
  await anonymous.getByRole('link',{name:'Recuperar contraseña',exact:true}).click();
  await anonymous.waitForURL('**/restablecer-contrasena');
  console.log('UI OK: 9 exportaciones con fallo/reintento a 360/768/1280; rutas privadas y recuperación con router actualizado.');
} finally {
  await browser.close();await server.close();
  if(production){production.httpServer.closeAllConnections();await new Promise(resolve=>production.httpServer.close(resolve));}
}
