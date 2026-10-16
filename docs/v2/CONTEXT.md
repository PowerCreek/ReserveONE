# v2 accumulated context (read first; the lead amends in place)
- Domain truth: `docs/SPEC.md` (§ refs), v1 code in `src/` (read-only reference), v1 decisions in `docs/HANDOFF.md`.
- v2 lives in `v2/`; branch `v2/engine-sim`; v1 stays untouched until parity.
- Build target: one self-contained `dist/index.html`; tests run with node (no browser).
- Stack: TypeScript, esbuild, Tailwind CLI (compiled at build), vanilla DOM + Proxy/MutationObserver (no React).
