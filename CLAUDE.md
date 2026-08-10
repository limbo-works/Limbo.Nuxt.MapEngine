# @limbo-works/map-engine

## What this is

A Nuxt module (`src/module.ts`) providing a pan/zoom SVG map engine — layers,
POIs (points of interest), and viewport control — for the **Herningsholm map
function**. This repo is the standalone engine only. The Umbraco/CMS side
(page type, editor UI, icon pool management, map block on the marketing
site) is a separate project and is out of scope here — see "Scope
boundary" below.

The `playground/` app is a Nuxt app consuming the module via
`extends: ['../src/module']`-style local resolution, used for local
development and as the de facto integration example. It is not a shipped
product surface — `playground/app.vue`'s demo buttons, sprite globbing, and
scale-factor tables exist to exercise the engine, not to define its API.

Read `scope-of-work.md` (repo root) before starting any feature work —
section numbers (e.g. §3.5) are referenced in GitHub issues and should be
referenced in new ones too. It is the authoritative product spec; when SoW
prose and an issue description disagree, the SoW wins.

## Architecture

Everything lives under `src/runtime/`:

- **`composables/`** — `useMapEngine`, `useMapViewport`, `useMapLayer`,
  `useMapPoint`, `useMapGroup`, `useMapFloor`, `useMapSprite`, `useMapUrlSync`
  are plain factory functions returning `reactive()` objects (not classes,
  not Pinia, not `ref`-based composables in the usual Nuxt-project sense —
  this module has its own conventions, see below). `onUpdate` is the shared
  `requestAnimationFrame` driver.
- **`components/`** — `MapEngine.vue` (top-level, owns `engine.points` and
  `engine.layers` rendering), `MapViewport.vue` (pointer/wheel gesture
  handling, owns the pan/zoom transform), `MapLayer.vue`, `MapPoint.vue`.
  `MapContentOverlay.vue` is playground demo UI, not a runtime component —
  see "Selection" below.
- **`types/`** — one file per concept (`engine.ts`, `viewport.ts`,
  `layer.ts`, `point.ts`, `group.ts`, `floor.ts`, `sprite.ts`, `urlSync.ts`,
  `geometry.ts`), re-exported from `types/index.ts`. Every runtime object
  has a matching `I<Name>` interface and, where authors construct it, an
  `I<Name>Options` input type.
- **`utils/`** — pure helpers (`math.ts`, `viewport.ts`, `points.ts`,
  `search.ts`, `update.ts`), deliberately not auto-import-registered; see
  `docs/code-style.md`.

### The engine object

`useMapEngine()` returns the single `IEngine` reactive root: `viewport`,
`layers`, `points`, `groups`, `floors`, `selectedFloor`, `selectedGroup`,
plus engine-level actions — `selectPoint`, `activatePoint`,
`selectOriginPoint`, `searchPoints`, `selectFloor`, `getAvailableFloors`,
`selectGroup`, `getGroupPoints`, `toggleLayer`, `toggleGroup`,
`getToggleableLayers`. It's passed down as a prop (`:engine="engine"`)
rather than provided/injected — follow that pattern for anything new that
needs engine access.

Floor and search selection are deliberately independent of each other and
of point selection — neither clears the others' state. `selectGroup` is
the one exception: selecting a group (not deselecting one) clears both the
destination and origin selection via `selectPoint(null)`, since the
group's own fitToPoints framing would otherwise strand a selection outside
the new frame. `selectPoint`/`selectOriginPoint` are also coupled to each
other (selecting a new destination clears the origin pairing; see
"Selection" below). Don't add further cross-clearing between
floors/search/groups/selection unless the SoW or user explicitly asks for
it.

### Coordinate spaces (read `useMapViewport.ts`'s top comment before touching zoom/pan math)

Three coordinate spaces are in play and code must not mix them up:

1. **World-pixel space** — raw coordinates in the reference layer's native
   SVG units. `ILayer.position` and `IPoint.position` live here.
2. **Normalized space** — `viewport.center` in `[0, 1]` of the world,
   independent of world size. Deliberately designed to be stable enough to
   round-trip through a URL (see the shareable-URL issue).
3. **Screen-pixel space** — pixels relative to `.c-map-viewport`.

`viewport.scale` is a multiplier on top of cover-fit (`scale = 1` is the
smallest scale that fully covers the viewport). `worldToScreen` /
`screenToWorld` convert between (1) and (3); never hand-roll that math
elsewhere.

### Animation

All viewport motion (`pan`, `zoomTo`, `zoomBy`) goes through one
`animateTo()` internal function and is advanced every frame by the
`onUpdate` RAF loop — there is no separate CSS-transition-driven viewport
animation. `zoomTo`/`zoomBy` additionally track an `anchor` (a world point
pinned to a screen point across the tween) so the focused point's _screen_
position eases linearly instead of its world-space center, which is what
makes anchored zooms look correct instead of back-loaded. If you add a new
kind of viewport motion, reuse `animateTo`/`anchor` rather than inventing a
parallel path.

Per-component visual animation (e.g. the pin select/deselect motion in
`playground/components/MapPointPin.vue`) is CSS-driven and separate from
viewport animation — that's fine, they solve different problems (DOM
element state vs. shared viewport transform).

### Selection

`IPoint.selectedAsDestination` is the single source of truth for "this POI
is highlighted." It's runtime-managed (not part of `IPointOptions`, nothing
authors it at creation time) and mutated only through
`engine.selectPoint(point | null)`. Do not add a parallel
`engine.selectedPoint`/`activePoint` field — anything needing "what's
selected" should derive it from iterating `engine.points` or read the
specific point's `.selectedAsDestination`.

`IPoint.selectedAsOrigin` is the equivalent for pseudo-wayfinding's "where
are you now?" origin (§4.1), mutated only through `engine.selectOriginPoint`.

### Content & activation

The engine has no notion of what a point's content _is_ or what activating
it _does_ — `IPoint.content?: unknown` is an opaque, consumer-supplied
payload (content blocks, a link, an icon, anything); the engine never
reads its shape. `IPoint.clickable` (authored via `IPointOptions.clickable`,
default `true`) is what gates selection highlighting, `searchPoints`, and
grouping (SoW §3.3's bare icons author this `false`) — see `isPointInGroup`
in `utils/points.ts`.

`engine.activatePoint(point)` selects an unselected clickable point on the
first call; on a second call against an already-selected point it invokes
`IEngineOptions.onActivatePoint?.(point)` if the consumer supplied one —
the engine itself never opens an overlay or follows a link. The playground
(`playground/app.vue`'s `onActivatePoint` option, plus its own local
"which point's overlay is open" `ref` and `MapContentOverlay.vue`, now a
playground component) demonstrates the pattern a consuming site follows;
define your own `content` payload shape per site rather than assuming the
playground's.

### Search (§3.6, #10/#11 — closed)

`engine.searchPoints(query)` matches `IPoint.label` then `IPoint.tags`
(label matches sorted first), via `normalizeSearchText()` in
`utils/search.ts` — lowercases, substitutes Danish æ/ø/å before NFD
stripping (they aren't decomposable accents, so plain NFD misses them),
then strips remaining diacritics. Reuse this helper for any new
text-matching rather than writing a second normalizer.

### Floors (#5 — closed)

Floors are modeled like groups: `IFloor { id, label }` objects, authored
via `useMapFloor` and pushed onto `engine.floors`. `ILayer.floor` is a
`string` referencing `IFloor.id` (a layer with no `floor` shows on every
floor). `engine.selectedFloor` + `engine.selectFloor(floor | null)` is a
plain single-select, same shape as `selectGroup`. `getAvailableFloors()`
derives the _in-range_ subset from `ILayer.floor`/`ILayer.sprite.minScale`
— a floor is available only if some layer references it and that layer is
in-range at the current zoom — but **display order always follows
`engine.floors`' authored order**, not layer-push order or numeric
sorting.

### Groups (§3.5, #9)

`engine.groups: IGroup[]` (`id`, `label`, author-supplied CSS `color`) and
`IPoint.groups: string[]` (group ids) are the data model. `selectGroup`
mirrors `selectFloor`'s single-select shape and reuses
`viewport.fitToPoints` (via the same `focusScale`/`focusAnimation`
constants as `selectOriginPoint`) rather than a parallel bounds-fit path —
any new "frame these points" behavior should do the same.
`getGroupPoints(group)` filters `engine.points` by
`point.groups.includes(group.id)` **and** `point.clickable` (SoW §3.3
restricts grouping/search to clickable POIs) — see `isPointInGroup` in
`utils/points.ts`, shared with `searchPoints` and the per-point
group-visibility check.

The playground (`MapGroupPills.vue`, `MapGroupList.vue`) demonstrates the
filter-pill-row + POI-list-panel UI the SoW describes, including a
hover-preview state (`previewed` prop on `MapPointPin.vue`) that is
visual-only and does not touch `engine` state — only a real click calls
`engine.selectPoint`. Known open questions, not decided unilaterally:
toggle-off UX for the active pill, `fitToPoints` padding when the open
list panel covers part of the viewport, and where group pills sit relative
to the not-yet-built layer filters from #4.

## Scope boundary (engine vs. CMS)

The scope-of-work document covers a lot of ground that is **not** this
repo's job:

- Umbraco page type, "Modules" storage/folders, editor permissions —
  backend/CMS.
- Icon _pool_ upload and management — CMS authoring UI; the engine only
  needs to accept a resolved icon asset per POI.
- The marketing-site map block (title/CTA/illustration wrapper that opens
  a map) — belongs to the consuming Nuxt site, not this module.

When a scope-of-work feature has both a CMS half and an engine half (e.g.
tags: authored in Umbraco, matched in the engine's search), only build the
engine half here — the data model and runtime behavior — and note the CMS
half explicitly in the issue/PR rather than silently deciding it's out of
scope.

## Handling feature/change requests

1. **Locate the relevant SoW section** and any existing GitHub issue
   before writing code — issues #1–#14 already exist for most SoW gaps and
   the two flagged non-SoW items (pinch-zoom performance, stale SVG
   layers). Check `gh issue list` rather than assuming a feature is
   unplanned.
2. **Read the actual current-state code**, not just the issue description
   — issues note what exists today, but the code is the source of truth
   and may have moved on. In particular re-check `useMapViewport.ts`,
   `useMapEngine.ts`, and the relevant `types/*.ts` file for the object
   shape before extending it.
3. **Extend types before implementation.** Add fields to the `I<Name>`
   interface (and `I<Name>Options` if author-facing) first, then implement.
   Runtime-managed fields (like `selectedAsDestination`) do not belong in
   `*Options`.
4. **New engine capabilities are actions on `engine`**, following
   `selectPoint`'s shape: a plain function stored on the reactive engine
   object, mutating `IPoint`/`ILayer` fields directly rather than emitting
   events for internal state changes.
5. **New viewport motion** must go through `animateTo`, not a new
   animation mechanism — see "Animation" above.
6. **Playground changes are demo wiring, not API design.** If a feature
   needs playground changes to demonstrate it (new components, demo
   buttons, sample data), keep it clearly separated from `src/runtime/` —
   the playground should consume the engine's public surface the way a
   real site would, not reach into internals.
7. **Design-driven visual work** (pins, overlays, filters) should be
   checked against Figma via the Figma MCP tools
   (`get_design_context`/`get_motion_context`/`get_screenshot`) rather than
   guessed from prose — this project has an active Figma file and prior
   work here has pulled exact pixel values, colors, and motion curves from
   it. If a needed variant/state isn't in the Figma file, say so rather
   than inventing a look.
8. **Verify in a real browser** for anything visual or interactive, if the
   users asks for it. See `verify` skill / Chrome DevTools MCP tools. Type-
   checking and lint passing is not sufficient evidence a feature works.
   Check `list_console_messages` for regressions.
9. **Ask before deciding product behavior the SoW leaves ambiguous**
   (animation durations/easings not specified, small-viewport/touch
   layout for new panels, exact copy/labels). Flag it rather than picking
   silently — several existing issues (#6, #8) already flag such gaps.

## Conventions

- No TypeScript classes; plain factory functions returning `reactive()`.
- One type file per concept in `types/`, always re-exported from
  `types/index.ts`.
- BEM-ish class naming (`c-map-point`, `c-map-point-pin__label`,
  `c-map-point-pin--selected`), nested CSS with `&`, root selector wrapped
  in `:where(...)` for zero specificity — see any existing component's
  `<style>` block.
- `<style>` blocks have **no `lang` attribute** in this repo (not
  `lang="postcss"`) — match existing files over any stale rule docs.
- Tabs, single quotes, no comments except non-obvious "why" — consistent
  with the global JS/Vue rulesets, but this repo's own files are the
  ground truth if the two ever disagree.
- Run `yarn lint`, `npx prettier --check .`, and `vue-tsc` (via a scratch
  tsconfig with `"ignoreDeprecations": "6.0"` to dodge the `.nuxt`-inherited
  `baseUrl` deprecation warning under plain `nuxi typecheck`) before
  calling anything done.
