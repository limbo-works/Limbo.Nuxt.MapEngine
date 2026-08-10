# Performance

The engine targets a locked 120 FPS during pan and zoom on displays that
support it (60 elsewhere), **including inside consuming sites with large
stylesheets**. That last part is the hard one, and this page documents
the three architectural decisions that make it hold — plus the rules for
not regressing them. The numbers below come from profiling the engine
inside a real solution (~1,200-node sprites, ~1,200 site CSS rules) in
August 2026.

## The problem shape

Two facts multiply into the frame budget:

1. Changing an **inherited CSS custom property** on an element
   invalidates the computed style of every descendant.
2. Recalculating one element's style costs in proportion to the
   stylesheet it must be matched against — trivial in the package
   playground (~130 rules), ~10× more inside a real solution
   (UnoCSS preflight, `:has()` rules, ~1,200 rules).

An engine that broadcasts per-frame state as inherited custom properties
from the top of the sprite subtree therefore restyles every SVG node
against the whole site stylesheet on every frame. Measured: ~19 ms per
frame — a solid 53 FPS ceiling on a 120 Hz display, invisible in the
playground where the same recalc costs ~1–2 ms.

## The three decisions

### 1. Per-frame state is written as direct properties, never custom properties

`MapViewport` writes the pan/zoom transform as an inline
`transform`/`width`/`height` on `.c-map-viewport__inner`; `MapPoint`
writes each point's screen position as an inline `transform`. Direct
(non-inherited) properties invalidate only the element they're set on —
a pan restyles one element per frame instead of ~1,300.

### 2. `--viewport-scale` is the one variable — and it's quantized

The sprite stroke/mark counter-scaling genuinely needs the current scale
as a CSS variable (`--viewport-scale`, set on the viewport inner
element). It only changes while zooming, and it's quantized to ~3%
multiplicative steps (`quantizeScale` in `MapViewport.vue`): a
continuous zoom invalidates the sprite subtrees every few frames instead
of every frame, while the actual transform stays exact. The ≤1.5%
stroke-width error is imperceptible — the whole map is scaling at the
same time.

### 3. Sprites render inside ShadowRoots

`MapLayer` mounts each sprite into a ShadowRoot on its wrapper, with the
sprite's own small stylesheet injected per root (`spriteStyles`). Site
CSS cannot reach sprite internals, so when `--viewport-scale` does step,
each sprite node re-matches ~10 rules instead of the consuming site's
~1,200. That's what turns the remaining per-step recalc from ~18 ms into
~1–2 ms — and it's why the engine's frame rate no longer depends on the
size of the site around it.

Custom properties still inherit across the ShadowRoot boundary, which is
exactly how `--viewport-scale`/`--scale-factor`/`--scale-origin` reach
the sprites.

## Consequences you'll notice

- **Site CSS can't restyle sprite internals** (by design — see
  [Sprite authoring](./sprite-authoring.md)). The wrapper
  (`.c-map-layer-transition`, with `data-layer-name`/`data-layer-kind`)
  stays in the light DOM for per-layer hooks like the fade duration.
- **Layer SVGs are not in SSR HTML** — the ShadowRoot is built on mount.
  Consumers rendering the map client-only (the normal case) see no
  difference.
- **Tests must pierce the ShadowRoot** to assert on sprite internals —
  see `findSprite` in `test/components/MapLayer.spec.ts`.

## Rules when extending the engine

- **Never reintroduce a per-frame-changing custom property** on
  `.c-map-viewport__inner`, `.c-map-point`, or any ancestor of the
  sprites. New per-frame state goes through direct inline properties
  (transform, opacity) on the narrowest element possible, exactly like
  the existing writes.
- **Per-frame JS writes, not template bindings, for hot paths.**
  `MapPoint` positions via a `watchEffect` + inline style write;
  `MapLayer`'s fades tween `opacity` imperatively. Follow that pattern —
  a template `:style` binding on a hot path funnels through component
  re-render.
- **New viewport motion goes through `animateTo`** (see `CLAUDE.md`) —
  one RAF loop, no parallel CSS-transition animation paths for the
  shared transform.
- **Measure in a consuming site, not the playground.** The playground's
  tiny stylesheet hides exactly the class of regression this page is
  about. Drive a synthetic pan/zoom and check frame times in a real
  solution (or temporarily inject a few hundred dummy rules).

## Rules for consumers

- **Keep per-frame reads out of wide reactive scopes.** Anything in your
  `#overlay` slot that reads `engine.viewport.scale` or
  `engine.viewport.center` re-renders on every animation frame during
  gestures. That's fine for a small zoom-button row; don't hang a large
  component tree off those reads — isolate them in a small child
  component.
- **Don't observe the map subtree with attribute-level
  MutationObservers** that do layout-forcing work (`checkVisibility`,
  `getBoundingClientRect`) in the callback — the engine mutates inline
  styles every frame, so such an observer runs constantly. Debounce it
  or exclude the map's subtree.
- **Don't wrap `.c-map-viewport__inner` or the sprites in extra
  inherited-variable machinery** (e.g. a theme system that rewrites
  custom properties on an interval) — variable churn above the sprites
  re-triggers the exact invalidation the architecture avoids.
- The engine's own DOM (viewport, points) stays in the light DOM and is
  yours to style via the documented `c-map-*` hooks — the isolation
  boundary is only around sprite internals.

## Verifying a change

A quick harness (paste into the console of a page showing the map):
drive a synthetic pointer-drag and count rAF frame times — average FPS
and p95 frame duration tell you everything. Aim for p95 ≤ 9 ms on a
120 Hz display. Chrome DevTools' performance panel attributes any misses:
look for `UpdateLayoutTree` events with element counts in the hundreds+
per frame — that's the inherited-variable signature; a healthy trace has
single-digit element counts during pan and small, ~1–2 ms recalcs on
zoom steps.
