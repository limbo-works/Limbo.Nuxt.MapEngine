# Code style

The baseline is the Limbo global rulesets (`ruleset-nuxt-general.md`,
`ruleset-vue-components.md`, `ruleset-js-files.md`). This document records
how they apply to this repo — a **TypeScript Nuxt module** rather than the
JS-based Nuxt apps the rulesets were written for — and the handful of
deliberate deviations. Where this file and the rulesets disagree, this
file wins for this repo.

## Language & typing

- **TypeScript throughout** (`.ts`, `<script setup lang="ts">`). The
  ruleset's "no TypeScript" applies only to projects that don't already
  use it; this one does.
- **Props/emits**: type-based declarations —
  `defineProps<{ engine: IEngine }>()`, `withDefaults(...)` for defaults,
  typed `defineEmits<{ preview: [point: IPoint | null] }>()`. This is the
  TS adaptation of the ruleset's runtime-object notation; do not convert
  to object notation.
- **Types**: one file per concept in `src/runtime/types/`, re-exported
  from `types/index.ts` and from `module.ts` (the packaged entry). Every
  runtime object has an `I<Name>` interface plus, where authors construct
  it, an `I<Name>Options` interface (interfaces, not type aliases). Named
  unions (e.g. `LayerKind`) are plain PascalCase without the `I` prefix.
- Runtime-managed fields (`selected`, `forceVisible`, `anchor`, …) never
  appear in `*Options`.

## Imports

- **`src/runtime/` uses explicit imports for everything** (Vue APIs
  included). It is distributed module code and must compile standalone —
  under Vitest, in consuming apps, and through `nuxt-module-build`.
- **`playground/` relies on auto-imports** for Vue/Nuxt APIs and for this
  module's composables (`useMapEngine()`, `useMapLayer()`, … used bare),
  exactly like a real consuming app. Only three kinds of explicit imports
  remain there:
    1. SFC imports for sibling components (`Icons/*`, values that would
       otherwise get Nuxt's path-prefixed registration names),
    2. `import type { … } from '../../src/runtime/types'` (types are never
       auto-imported; a packaged consumer would import them from
       `@limbo-works/map-engine`),
    3. named helper exports from `src/runtime/utils/` (`normalizeSearchText`,
       `isPointInGroup`) — `utils/` isn't in the auto-import scan (only
       `composables/` is), so these always need an explicit import in the
       playground, unlike a bare `useMapEngine()` call. A packaged consumer
       gets the same two re-exported from the module entry (`src/module.ts`).
- Import order: Vue/runtime imports → SFC/asset imports → local
  composables/utils → `import type` last.
- Internal helpers live in `src/runtime/utils/` (`math.ts`, `viewport.ts`,
  `points.ts`, `search.ts`, `update.ts`), which is deliberately **not**
  registered for auto-import — only `composables/` and `components/` are
  public surface.

## Functions & reactivity

- Composables: `export default (options) => { … }` factory functions
  returning `reactive()` objects (this repo's documented convention —
  `reactive()` is otherwise reserved per the ruleset). `use<Name>` for
  state factories, `on<Name>` for lifecycle-registering helpers.
    - `useMapGestures` deviates deliberately: it takes an `IViewport`
      rather than an options object, and returns a **plain** object rather
      than a `reactive()` one. It exposes event handlers and holds no
      reactive state, so wrapping it in `reactive()` would buy nothing and
      imply state that isn't there. Reach for `reactive()` by default;
      this is the exception, not a new pattern.
- Everything else: `function` declarations for helpers, handlers, and
  utilities — never module-level arrow consts. Arrows only for inline
  callbacks.
- `<script setup>` internal order: props/emits → template refs +
  composable calls → reactive state → computeds → lifecycle hooks →
  watchers → function declarations. (Watchers may precede lifecycle when
  the mount hook depends on them; keep the drift minimal.)
- Element refs use `useTemplateRef('name')`, not
  `ref<HTMLElement | null>(null)`.

## Components & CSS

- BEM-ish classes with a `c-` prefix (`c-map-point-pin__label`,
  `c-map-point-pin--selected`), root selector wrapped in `:where(…)` for
  zero specificity, nested CSS with `&`.
- **`<style>` blocks carry no `lang` attribute** — this repo's explicit
  override of the ruleset's `lang="postcss"` (see CLAUDE.md). No UnoCSS,
  no `@apply`, never `scoped`.
- Generic primitives live in `playground/components/Base/` (`BasePill`,
  `BaseIconButton`); per-site variations layer their own classes over the
  zero-specificity base instead of forking the markup.
- `src/runtime` components must not depend on playground code.

## Formatting & naming

- Tabs, single quotes, **semicolons** (repo Prettier config wins over the
  ruleset's no-semicolons note). `yarn lint`, `npx prettier --check .`,
  and `yarn typecheck` must pass.
- camelCase for variables/functions; no snake_case.
- Coordinate-space vocabulary is fixed by `useMapViewport.ts`'s header:
  _world_ (world-pixel), _normalized_ (`[0,1]` of the world), _screen_
  (pixels relative to `.c-map-viewport`). Name new values and helpers in
  those terms (`worldToScreen`, `toScreen`, `clampCenter`).
- Comments explain non-obvious _why_ only — hidden constraints,
  invariants, workarounds. Reference material belongs in `docs/`, not in
  comments.

## Blank-line rhythm

- One blank line between logical steps inside a function; none inside a
  tight statement group.
- Two consecutive declarations that form one thought (e.g. a ref and its
  watcher) may sit together; otherwise separate top-level statements in
  `<script setup>` with a single blank line.
