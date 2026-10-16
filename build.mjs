import {build,context} from 'esbuild';import fs from 'fs';
const opts={entryPoints:['src/main.tsx'],bundle:true,minify:true,write:false,format:'iife',target:'es2020',define:{'process.env.NODE_ENV':'"production"'}};
const out=process.env.OUT||'dist/index.html';
const wrap=r=>{const js=r.outputFiles[0].text.replace(/<\/script>/g,'<\\/script>'),css=fs.readFileSync('src/styles.css','utf8');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Host Seating Planner</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
  fs.mkdirSync(out.replace(/[\\/][^\\/]*$/,'')||'.',{recursive:true});fs.writeFileSync(out,html);return html.length};
if(process.env.WATCH){
  const ctx=await context({...opts,plugins:[{name:'rebuild-log',setup(b){b.onEnd(r=>{if(r.errors.length)return console.error('build error',r.errors);
    console.log('rebuilt',new Date().toTimeString().slice(0,8),(wrap(r)/1024|0)+'KB')})}}]});
  await ctx.watch();console.log('watching for changes (Ctrl+C to stop)');
}else{
  const r=await build(opts);console.log('built',(wrap(r)/1024|0)+'KB');
}
