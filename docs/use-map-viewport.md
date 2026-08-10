# `useMapViewport`

```ts
const viewport = useMapViewport(options?: IViewportOptions);
```

Normally you don't call this directly — `useMapEngine` creates it as
`engine.viewport` and forwards its own `viewport` option through (see
[`useMapEngine`](./use-map-engine.md)). Documented separately here because
this is where most of the configurable behavior actually lives.

Read the coordinate-space comment at the top of
`src/runtime/composables/useMapViewport.ts` before changing anything
zoom/pan-related — `center` is normalized `[0, 1]` independent of world
size, `scale` is a multiplier on top of cover-fit (`scale = 1` fully
covers the viewport), and `worldToScreen`/`screenToWorld` are the only
sanctioned conversions between world-pixel and screen-pixel space.

## Options (`IViewportOptions`)

| Option             | Type                      | Default                                            | Description                                                                                                                                                                                                          |
| ------------------ | ------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `worldSize`        | `{ width, height }`       | derived from the largest layer's sprite dimensions | Overrides the world-pixel size used to normalize `center`. Only needed until layers can be positioned relative to each other — today every layer stretches to the same box, so the largest sprite defines the world. |
| `center`           | `{ x, y }` (each `[0,1]`) | `{ x: 0.5, y: 0.5 }`                               | Initial view center (SoW §3.2 "editor-defined starting zoom level"). Clamped to `[0, 1]` on each axis on init, same as any pan/zoom target.                                                                          |
| `scale`            | `number`                  | `1`                                                | Initial zoom multiplier. Clamped to `[minScale, maxScale]` on init.                                                                                                                                                  |
| `minScale`         | `number`                  | `1`                                                | Lower zoom bound. `1` is cover-fit (can't zoom out past "fills the viewport"); raising it forbids zooming out further than that.                                                                                     |
| `maxScale`         | `number`                  | `40`                                               | Upper zoom bound, enforced by every zoom/pan/fit operation.                                                                                                                                                          |
| `duration`         | `number` (ms)             | `600`                                              | Default tween duration for `pan`/`zoomTo`/`zoomBy`/`fitToPoints` when the call site doesn't override it.                                                                                                             |
| `easing`           | `(t: number) => number`   | `easeOutCubic`                                     | Default easing curve for the same calls. `t` and the return value are both `[0, 1]`.                                                                                                                                 |
| `wheelSensitivity` | `number`                  | `0.5`                                              | Multiplier on discrete wheel-tick and ctrl+wheel/trackpad-pinch zoom speed. Does **not** apply to touch pinch or drag, which are geometric (1:1 with the gesture) by design.                                         |
| `momentum`         | `number`                  | `1`                                                | Multiplier on release-glide (fling) distance after a pan/pinch. `0` disables the glide entirely.                                                                                                                     |
| `layers`           | `ILayer[]`                | `[]`                                               | Supplied internally by `useMapEngine` as `engine.layers` — used only to derive `worldSize` when it isn't given explicitly. Not meant to be set by hand.                                                              |

## Runtime state and methods (`IViewport`)

| Member                              | Description                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `center`                            | `{ x, y }`, normalized `[0, 1]` of the world. Reactive; mutates every animation frame during motion.                     |
| `scale`                             | Current zoom multiplier on cover-fit. Reactive per frame during zooms — see the note below before binding wide UI to it. |
| `minScale` / `maxScale`             | The resolved bounds.                                                                                                     |
| `size`                              | `{ width, height }` of the viewport element in px, kept current by a ResizeObserver.                                     |
| `wheelSensitivity` / `momentum`     | The input-feel knobs, mutable at runtime.                                                                                |
| `pan(delta, options?)`              | Animated pan by a screen-pixel delta.                                                                                    |
| `zoomTo(point, scale, options?)`    | Frames a world point at a scale; `options.origin` places it off-center (e.g. beside a panel).                            |
| `zoomBy(factor, origin?, options?)` | Multiplies the target scale, anchored at a screen point (defaults to center) — what zoom buttons call.                   |
| `fitToPoints(points, options?)`     | Frames a set of world points with padding; per-side padding shifts the frame into the unoccluded strip.                  |
| `stop()`                            | Freezes the viewport where it currently is (grab-mid-glide).                                                             |
| `worldToScreen` / `screenToWorld`   | The only sanctioned conversions between world-pixel and screen-pixel space.                                              |
| `getTransform()`                    | The rendered transform (`x`, `y`, `scale`, `width`, `height`) — what `MapViewport` writes to the DOM.                    |
| `setElement(element \| null)`       | Registers the size-reference element; called by `MapViewport` on mount/unmount, not by consumers.                        |

`center` and `scale` changing on every animation frame means anything
reactive that reads them re-evaluates at the display's frame rate during
gestures — fine for a small control, wasteful for a big component tree.
Isolate such reads in small components (see
[Performance](./performance.md)).

## Per-call animation options

These aren't constructor options — they're the second/third/fourth
argument to `pan`, `zoomTo`, `zoomBy`, and `fitToPoints`, and they override
the `duration`/`easing` above for that one call only:

- `IViewportAnimationOptions`: `{ duration?, easing? }` — accepted by `pan`
  and as the base of the other two.
- `IViewportZoomOptions` (`zoomTo`): adds `origin?: IVector` — where on
  screen (`[0,1]` each axis) the focused point should end up; defaults to
  center. Use this to focus a point while leaving room for a side panel,
  e.g. `{ x: 0.75, y: 0.5 }`.
- `IViewportFitOptions` (`fitToPoints`): adds `padding?: number |
IViewportPadding` (screen pixels kept clear around the fitted bounds —
  a plain number applies to all sides, default `250`; a per-side object
  like `{ left: 420 }` defaults unset sides to `0` and shifts the frame's
  center into the unoccluded strip, e.g. beside an open panel) and
  `maxScale?: number` (per-call cap, so a tight cluster of points doesn't
  zoom in to the viewport's own `maxScale`).

All viewport motion goes through one internal `animateTo()`/RAF loop —
there's no separate CSS-transition path for the pan/zoom transform itself.
