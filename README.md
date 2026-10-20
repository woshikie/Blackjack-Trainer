# Blackjack Trainer

A free, offline-first blackjack basic-strategy trainer. Runs entirely in the browser — no accounts, no server. Built with Vue 3 + Vite + TypeScript and deployed to GitHub Pages.

**Live app:** https://woshikie.github.io/blackjack-simulator/

## What it trains

- **Basic strategy grading** in three feedback modes: strict (blocks wrong plays until you pick the right one), lenient (flags but executes), and silent (tallies mistakes for review).
- **Hi-Lo counting overlay** (pluggable `CountSystem`; automatically disabled under a CSM). Insurance grading follows the Illustrious-18 style index (take at TC ≥ +3 when counting).
- **Configurable rules**: decks (1/2/4+), S17/H17, peek vs ENHC, DAS, double ranges, split/aces rules, surrender, penetration, CSM, table limits.

## Quick start

```bash
npm install
npm run dev        # local dev server
npm test           # full suite with coverage gate
npm run build      # typecheck + production build
```

## Testing & coverage gate

Vitest + `@vue/test-utils` + happy-dom, v8 coverage. The suite enforces **100% statements / branches / functions / lines** over `src/domain/**` and `src/stores/**` (`.vue` files excluded). Unreachable defensive branches are not tolerated — invariants are expressed as non-null assertions instead of guards.

```bash
npx vitest run --coverage
```

## Strategy charts

Canonical 4–8 deck charts follow standard Vegas multi-deck basic strategy (verified against Wikipedia / Wizard of Odds conventions). The **1- and 2-deck chart families are encoded from the same conventions from memory — flag for independent audit before treating them as canonical.** Notable edges:

- Pair 8,8 vs A surrenders only in H17 4+ deck games (`p8` override).
- No-DAS pair cells revert to HIT directly (4,4 vs 5 without DAS hits; a plain hard 8 would double).
- ENHC (no-peek) games block doubles/splits vs T/A (except A,A vs T) and disable surrender.
- See `docs/adr/0001-strategy-engine-charts-over-simulation.md` and `GLOSSARY.md` for the full model.

## Deploy

Push to `main` — `.github/workflows/deploy.yml` runs install → `vue-tsc` → `vitest --coverage` (the 100% gate) → build → GitHub Pages. Pages must be set to **Deploy via GitHub Actions** in the repo settings.
