import {build} from 'esbuild'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
const js = (await build({entryPoints: ['v2/main.ts'], bundle: true, minify: true, write: false, format: 'iife', target: 'es2022'})).outputFiles[0].text.replace(/<\/script>/g, '<\\/script>')
const css = execFileSync('node_modules/.bin/tailwindcss', ['-i', 'v2/ui/app.css', '--minify'], {encoding: 'utf8'})
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>reserveONE v2</title><style>${css}</style></head><body class="bg-ink"><div id="app"></div><script>${js}</script></body></html>`
fs.mkdirSync('dist', {recursive: true})
fs.writeFileSync('dist/v2.html', html)
console.log('built v2', (html.length / 1024) | 0, 'KB')
