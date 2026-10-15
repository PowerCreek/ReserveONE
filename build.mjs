import {build} from 'esbuild';import fs from 'fs';
const r=await build({entryPoints:['src/main.tsx'],bundle:true,minify:true,write:false,format:'iife',target:'es2020',define:{'process.env.NODE_ENV':'"production"'}});
const js=r.outputFiles[0].text.replace(/<\/script>/g,'<\\/script>'),css=fs.readFileSync('src/styles.css','utf8');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Host Seating Planner</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`;
const out=process.env.OUT||'dist/index.html';fs.mkdirSync(out.replace(/[\\/][^\\/]*$/,'')||'.',{recursive:true});fs.writeFileSync(out,html);console.log('built',(html.length/1024|0)+'KB');
