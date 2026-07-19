# SwasthyaAI Design System — "Night Ward"

The visual language of a voice-first medical AI: the calm of a hospital
ward at night, the glow of a monitor that's watching over you. Dark,
clinical, alive — never neon, never playful-startup.

## Principles

1. **The AI is the protagonist.** Cyan belongs to the assistant alone —
   its orb, its waveform, its focus rings. Nothing else gets the accent.
2. **Motion communicates state, or it doesn't exist.** Breathing = alive,
   ripples = hearing you, rotating rings = working, waves = speaking.
   No decoration-only animation.
3. **One surface system.** Everything sits on deep navy; content lives on
   glass. If a card needs to feel interactive, it floats on hover —
   static information never moves.
4. **Semantic color is sacred.** Green/amber/red appear only for
   success/warning/error — never decoratively.

## Color

| Token | Value | Use |
|---|---|---|
| `--ink-950…700` | `#050b18 → #14264c` | backgrounds, elevation by lightness |
| `--cyan-400` / `--aqua-300` | `#22d3ee` / `#67e8f9` | the AI accent (orb, CTAs, focus) |
| `--ok` / `--warn` / `--danger` | `#34d399` / `#fbbf24` / `#f87171` | semantics only, with `*-dim` fills |
| `--text-hi/mid/low` | `#eaf2ff` / `#9fb3d1` / `#5d7397` | 3-step text hierarchy |
| `--glass-*` | rgba blues + blur 18px | card surfaces |

Contrast: `--text-hi` on `--ink-900` ≈ 15:1; `--text-mid` ≈ 7:1 (AA+).

## Typography

- **Space Grotesk** (`--font-brand`): brand, headings, metric values —
  geometric and technical.
- **Inter** (`--font-body`): everything else.
- Scale: 12 label / 14 body / 16 emphasized / 18–24 headings / 28+ metrics.

## Spacing

4px scale: `--sp-1 (4)` … `--sp-12 (48)`. Cards pad 18–24; sections gap 20–32.

## Motion

| Token | Value | Means |
|---|---|---|
| `--dur-fast` 150ms | hover, focus | reaction |
| `--dur-med` 300ms | cards, dialogs | transition |
| `--dur-slow` 600ms | scenes, splash | narrative |
| `--ease-swift` | decisive arrival (UI moves) |
| `--ease-spring` | pop-in (dialogs, success) |
| `--ease-breathe` | organic loops (orb, shimmer) |

`prefers-reduced-motion` collapses all animation globally.

## Components (`src/components/ui/`)

| Component | Notes |
|---|---|
| `Button` | primary (one per view) / glass / ghost / danger; `loading` keeps width |
| `GlassCard` | base surface; `floaty` = interactive hover-lift |
| `Skeleton`, `SkeletonCard` | shimmer placeholders — no "Loading..." text |
| `Dialog` | portal, scale-in, Esc/backdrop close, focus restore |
| `LanguagePills` | EN/हिं/த sliding-thumb selector |
| `EmptyState` | icon + title + action buttons — no blank screens |
| `MetricCard` | one number + context; skeleton until real data |
| `DnaHelix` | **the identity** — holographic double helix (see below) |
| `Waveform` | flowing bezier ribbons (not bars); canvas + rAF, DPR-aware |

## The DNA Helix — identity element

A holographic double helix: 9 rungs × 2 strands of glowing nodes with
computed 3D depth (far side recedes and dims), particles travelling the
strands, floating on a soft cyan bloom over a barely-there neural field.
Healthcare + AI in one glyph: *your biology, understood by intelligence*.
The splash's ECG heartbeat literally morphs into it.

| App state | Helix behavior |
|---|---|
| connected, quiet | `idle` — slow rotation, nodes breathe, particles drift |
| capturing mic | `listening` — rotation eases, brightness up, a pulse climbs the helix, particles gather mid-strand, sonar rings, faint ECG flows behind |
| LLM/tools running | `thinking` — neural sweep lights nodes & rungs sequentially, faster rotation, three orbiting motes (intelligence, not loading) |
| TTS playing | `speaking` — rhythmic node energy synced to `getLevel()`, particles stream downward, fast waves |
| booking confirmed | `success` — cyan→green, bottom-to-top pulse, gentle 12-particle burst, settles back (~1.7s) |
| failure | `error` — rotation pauses, glow fades, one soft amber pulse; never alarming |
| mic denied / no session | `muted` / `off` — dim grey, near-still |

Micro-interactions: cursor parallax (±7° perspective tilt, smoothed),
hover deepens the bloom, click fires a tap pulse (`onActivate`),
voice level accelerates particles. `withWaveform` renders the ribbon
waveform beneath for voice screens.

Engine: one rAF writes SVG attributes via refs — zero React re-renders
per frame; float/rings/ECG/field/tilt are separate composited CSS
layers. Reduced motion: the loop stops, pose is static, glow only.

## Performance rules

- Animate only `transform` and `opacity` (compositor-only, 60fps).
- Audio reactivity via refs + rAF — zero React re-renders per frame.
- Canvas is DPR-aware and resize-observed.
