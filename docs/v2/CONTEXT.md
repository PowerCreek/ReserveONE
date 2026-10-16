# v2 accumulated context (read first; the lead amends in place)
- Domain truth: `docs/SPEC.md` (§ refs), v1 code in `src/` (read-only reference), v1 decisions in `docs/HANDOFF.md`.
- v2 lives in `v2/`; branch `v2/engine-sim`; v1 stays untouched until parity.
- Build target: one self-contained `dist/index.html`; tests run with node (no browser).
- Stack: TypeScript, esbuild, Tailwind CLI (compiled at build), vanilla DOM + Proxy/MutationObserver (no React).
- Contracts + lanes: `docs/v2/ARCH.md` (frozen; changes via lead). Output file: `dist/v2.html`.
- Node 24 runs `.ts` directly: use `.ts` import extensions, `import type`, no enums/namespaces.
- Commands: `npm run v2:check|v2:test|v2:build`; lane tests `node --test "v2/<lane>/**/*.test.ts"`.
- Lanes do not commit; the lead commits after review. Tailwind `--watch` is untested; one-shot build is the loop.
