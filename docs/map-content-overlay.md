# `<MapContentOverlay>` (playground reference)

**This is not a runtime component.** It lives at
`playground/components/MapContentOverlay.vue` and is demo wiring — the
engine has no notion of content overlays, links, or icons (see
[`useMapPoint`](./use-map-point.md#content-and-activation) and
[`useMapEngine`](./use-map-engine.md)'s `onActivatePoint` option). This
page documents the playground's own reference implementation of the SoW
§3.4 content panel, for consumers building their own equivalent.

```html
<!-- playground/app.vue, inside MapEngine's #overlay slot -->
<MapContentOverlay
	:engine="engine"
	:point="openPoint"
	@close="openPoint = null"
>
	<template #default="{ point, content }"> … </template>
</MapContentOverlay>
```

The panel slides in from the right for whichever point the playground's
own `openPoint` ref names — set from `IEngineOptions.onActivatePoint` when
the activated point's content has blocks (see `playground/types.ts`'s
`IMapPointContent` and `playground/app.vue`).

## Props

| Prop         | Type             | Default | Description                                                                                                                                   |
| ------------ | ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine`     | `IEngine`        | —       | Used for the re-framing zoom (`viewport.zoomTo`, `focusScale`, `focusAnimation`).                                                             |
| `point`      | `IPoint \| null` | —       | The point whose content is shown, or `null` when closed. Owned by the consumer (the playground keeps it in a local `ref`), not by the engine. |
| `closeLabel` | `string`         | `'Luk'` | `aria-label` for the close button — the one Danish default in the playground.                                                                 |

## Events

| Event   | Payload | Description                                                                                                                                  |
| ------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `close` | —       | Emitted from the close button and the Escape key — the consumer clears its own open-point state in response (e.g. `openPoint.value = null`). |

## Behavior

- Shows the open point's `label` as the panel title.
- While open, the focused point is re-framed into the map strip the panel
  leaves visible (measured from the rendered panel width, so a CSS
  override of the panel width is automatically respected). On close, a
  still-selected point is re-framed to center.

## Slot

Default slot with `{ point, content }` scope, where `content` is the
playground's own `IMapPointContent['blocks']` read off the opaque
`IPoint.content` payload. Without a slot, a placeholder renders each
block's `title`/`alias`.

## CSS hooks & custom properties

- Classes: `c-map-content-overlay` (65% width, 100% on ≤768px —
  `:where()`-wrapped, so a consumer rule can resize it and the re-framing
  math follows), `__scroller`, `__title`, `__content`, `__close`,
  `__placeholder`.
- `--map-content-overlay-duration` (default `500ms`) and
  `--map-content-overlay-ease` (default: the Figma motion-spec spring as
  `linear(…)`, matching `engine.focusAnimation`) control the slide.
