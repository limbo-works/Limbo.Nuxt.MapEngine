# Documentation

Documentation for the engine's public surface. The guides walk through
building and integrating a map; the reference pages cover the options
every `useX` composable accepts, the runtime state and actions the
central objects expose, the components' props/slots/CSS hooks, and the
URL query params `useMapUrlSync` reads and writes. For anything not
spelled out here, the source in `src/runtime/types/` is the full shape
of every object, and the root `CLAUDE.md` describes the architecture.

## Guides

- [Getting started](./getting-started.md) — from an empty page to a full
  map: layers, floors, points, groups, search, overlay, URL sync.
- [Sprite authoring](./sprite-authoring.md) — the contract for producing
  the map SVGs (shared canvas, `scale_` marks, stroke rules, naming).
- [Cookbook](./cookbook.md) — recipes: custom pins, content overlays,
  filter pills, wayfinding, CMS wiring, deep links, camera moves.
- [Performance](./performance.md) — the 120 FPS architecture and the
  rules for not regressing it (engine authors and consumers both).

## Composables

- [`useMapEngine`](./use-map-engine.md)
- [`useMapViewport`](./use-map-viewport.md)
- [`useMapGestures`](./use-map-gestures.md)
- [`useMapLayer`](./use-map-layer.md)
- [`useMapPoint`](./use-map-point.md)
- [`useMapGroup`](./use-map-group.md)
- [`useMapFloor`](./use-map-floor.md)
- [`useMapSprite`](./use-map-sprite.md)
- [`useMapUrlSync`](./use-map-url-sync.md)

## Components

- [`<MapEngine>`](./map-engine.md)
- [`<MapViewport>`](./map-viewport.md)
- [`<MapLayer>`](./map-layer.md)
- [`<MapPoint>`](./map-point.md)

## Playground reference

Not part of the package, but documented for consumers building an
equivalent: [`<MapContentOverlay>`](./map-content-overlay.md) is the
playground's own content-overlay implementation, driven by
`IEngineOptions.onActivatePoint` rather than any built-in engine state.

## Meta

- [Code style](./code-style.md) — repo conventions and the deliberate
  deviations from the Limbo global rulesets.

## Conventions

- Every composable is a plain factory function: `useMapX(options)` returns
  a `reactive()` object. None of them are Vue `ref`-based composables in
  the usual Nuxt sense, and none use provide/inject — the engine object is
  passed down explicitly (`:engine="engine"`).
  [`useMapGestures`](./use-map-gestures.md) is the one exception on both
  counts: it takes an `IViewport` rather than an options object, and
  returns a plain object rather than a `reactive()` one — it exposes
  handlers and no reactive state.
- Composables and components are auto-imported/auto-registered by the
  module; types are imported from the package entry
  (`import type { IEngine } from '@limbo-works/map-engine'`).
- An options field with no default noted is `undefined` when omitted,
  which for most fields means "off" or "unbounded" rather than a
  substituted value — this is called out per field.
- Nothing here is authored on the runtime object it produces unless it's
  listed as an option — fields like `IPoint.selectedAsDestination` or
  `ILayer.forceVisible` are runtime-managed and can't be set at creation.
