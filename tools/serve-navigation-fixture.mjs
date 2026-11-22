// Local review server only: substitutes the API at module resolution, never in production.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({root,cacheDir:path.join(root,'work/navigation-vite-cache'),base:'/apartman-online/',plugins:[{
  name:'isolated-navigation-api',enforce:'pre',resolveId(source,importer){
    if(importer?.startsWith(path.join(root,'src')) && ['./api','../api'].includes(source)) return path.join(root,'tests/fixtures/navigation/api.ts');
  },
  configureServer(server){
    server.middlewares.use((req,_res,next)=>{
      if(req.url?.split('?')[0]==='/apartman-online/') req.url=req.url.replace('/apartman-online/','/apartman-online/tests/fixtures/navigation/index.html');
      next();
    });
  },
  transform(code,id){
    // Keep visual review offline: strip only the pre-existing remote font import in this server.
    if(id.split('?')[0]===path.join(root,'src/style.css')) return code.replace(/^@import[^\n]*\n/, '');
  },
}],server:{host:'127.0.0.1',port:5178,strictPort:true,hmr:false}});
await server.listen();
console.log('Isolated navigation fixture: http://127.0.0.1:5178/apartman-online/tests/fixtures/navigation/index.html');
