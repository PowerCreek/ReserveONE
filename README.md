# Host Seating Planner

A single-page host-stand tool (floor canvas, Gantt, reservations, queue, N-top predictor, staff, audit log).
**No backend**: it builds to ONE static HTML file with no external requests. All data lives in the browser (`localStorage`, per browser and per site address).

## Just host it (no build)
`dist/index.html` is the prebuilt app. Upload it to any static host (Netlify/Vercel drop, GitHub Pages, S3/CloudFront, nginx, Apache, Caddy) or try it locally:

    npx serve dist          # or: python3 -m http.server -d dist 8080

Use HTTPS in production (needed for the alert chime and clipboard copy in some browsers).

## Build from source
Requires Node 18+.

    npm install
    npm run build           # -> dist/index.html
    npm test                # typecheck + unit + build + headless smoke test

Other scripts: `npm run check` (types), `npm run test:unit` (pure logic), `npm run test:smoke` (needs a build first).
Set `OUT=path/to/file.html` to write the build elsewhere.

## Notes
- **Data is per browser + per address.** Changing the URL/domain or clearing site data starts fresh (header "↺ Reset data" also resets to the demo seed). There is no sync between devices.
- Demo data is created by `src/seed.ts`; edit it to start from your own floor plan.
- Layout: `src/` app (types, geometry, engines, state, components), `tests/` unit tests, `docs/` specs and living handoff (`HANDOFF.md`, `PROTOCOLS.md`, `SPEC.md`).

## Continuing in git / Claude Code
```
unzip host-seating-planner-source.zip && cd hsp
git init && git add -A && git commit -m "Host Seating Planner"
npm install && npm test && npm run build   # Node 18+; output: dist/index.html
claude                                      # Claude Code reads CLAUDE.md -> docs/HANDOFF.md + docs/PROTOCOLS.md
```
Host `dist/index.html` anywhere static. Data lives in each browser's localStorage (per address).
