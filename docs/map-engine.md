# `<MapEngine>`

```html
<MapEngine :engine="engine">
	<template #point="{ point }"> … </template>
	<template #overlay> … </template>
</MapEngine>
```

The top-level component — renders the pannable/zoomable viewport with every
layer, positions every point, and stacks the consumer UI above them.
Auto-registered by the module, like all `Map*` components.

## Props

| Prop     | Type      | Description                                                                                                |
| -------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `engine` | `IEngine` | The engine instance from `useMapEngine()` — every `Map*` component takes it as a prop (no provide/inject). |

## Slots

| Slot      | Scope               | Description                                                                                                                                                                                                                                    |
| --------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `point`   | `{ point: IPoint }` | Rendered once per point inside its positioned [`<MapPoint>`](./map-point.md) wrapper — supply the visual marker (the playground's `MapPointPin` is the reference).                                                                             |
| `overlay` | —                   | Consumer UI layered above the map (search, pills, zoom controls, and — per the playground's example — a content overlay of your own). Read state straight off your own `engine` (e.g. `engine.viewport.scale`, `engine.getAvailableFloors()`). |

A content overlay is no longer built into the engine — the playground's
[`MapContentOverlay`](./map-content-overlay.md) demonstrates rendering one
from the `overlay` slot, driven by a consumer-owned "which point is open"
ref and `IEngineOptions.onActivatePoint` (see
[`useMapEngine`](./use-map-engine.md)).

## Behavior & stacking

- Layers render in `engine.layers` order inside the viewport transform;
  points and the overlay slot are screen-space siblings above it.
- Stacking is deliberate: points (`z-index: 1`) can never paint above the
  overlay slot (`z-index: 2`) — anything you render into `overlay`,
  including your own content panel, wins over points and layers.
- The points and overlay containers are `pointer-events: none` so empty
  regions pass pans through to the map; direct children of the overlay
  slot get `pointer-events: auto` back.

## CSS hooks

Root `class="c-map-engine"` (position: relative, `overflow: clip`,
`background-color: #dfe0e2` — all `:where()`-wrapped, override freely).
Children: `c-map-engine__layers`, `c-map-engine__points`,
`c-map-engine__overlay`.
