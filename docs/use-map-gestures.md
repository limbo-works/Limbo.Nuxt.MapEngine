# `useMapGestures`

```ts
const gestures = useMapGestures(viewport: IViewport);
```

Recognizes pan, pinch, wheel-zoom, and momentum from raw pointer input and
drives an [`IViewport`](./use-map-viewport.md) with them. Normally you don't
call this directly — [`<MapEngine>`](./map-engine.md) creates it and binds it
to both of its input surfaces. Documented separately because it is the whole
of the engine's input behavior, and because a consumer building their own
viewport surface can reuse it.

It takes the viewport, not the engine: nothing about gesture recognition
touches points, layers, floors, or groups.

## Interface (`IGestures`)

| Member            | Type                                | Description                                                                                                                                   |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `setElement`      | `(el: HTMLElement \| null) => void` | The element the recognizer measures against — pointer positions convert to screen-pixel space via its bounding rect, and drags capture to it. |
| `handlers`        | `IGestureHandlers`                  | The handler set, keyed by DOM event name so it spreads with `v-on`.                                                                           |
| `overlayHandlers` | `IGestureOverlayHandlers`           | Zoom-only handler set for UI surfaces stacked above the map — see below.                                                                      |

```vue
<div ref="root" v-on="gestures.handlers"></div>
```

Keys are DOM event names (`pointerdown`, `wheel`, …) rather than
`onPointerDown` style because Vue runs the keys of an object passed to
`v-on` through `toHandlerKey` — `onPointerDown` would register a listener
for an `onPointerDown` event.

The handlers call `preventDefault()` themselves where it matters (wheel and
the Safari gesture events), so bind sites don't need `.prevent` modifiers.

### Events are free to originate elsewhere

`setElement` names the measuring stick, not the only permitted event source.
`<MapEngine>` binds the same handler set on the viewport **and** on the
points overlay — a sibling element of identical geometry — so a gesture
starting on a POI pin pans and zooms exactly like one starting on bare map.
The two sites must share one instance: a two-finger pinch can land one
finger on a pin and the other on bare map, and only a shared recognizer
tracks those as a single gesture.

### `overlayHandlers` — zoom over the UI overlay

Zoom input over UI stacked on the map (`<MapEngine>`'s overlay slot) never
reaches the map's bind sites, and the browser's default for it is **page**
zoom — persistent on desktop, visual-viewport pinch on touch. Binding
`overlayHandlers` on such a surface routes that input to the map instead:

- **ctrl+wheel / trackpad pinch** always zooms the map — it never scrolls
  content.
- A **plain wheel** first yields to any scroller between the event target
  and the bind site that can consume it on the wheel's dominant axis (a
  suggestion list, a panel), and zooms the map otherwise.
- **Safari GestureEvents** zoom the map as on the main surfaces.

Pointer handlers are deliberately absent so buttons, scrollers, and
drag-driven sheets keep their native pointer behavior. That means a touch
pinch starting on the surface is not recognized either — the bind site must
block the browser's own pinch with `touch-action: pan-x pan-y`, as
`<MapEngine>` does on its overlay wrapper.

## Input types

Handlers are typed against what they actually read
(`IGesturePointerInput`, `IGestureWheelInput`, `IGestureScaleInput`) rather
than against DOM event classes. Real `PointerEvent`/`WheelEvent` instances
satisfy them structurally, so templates bind them directly — and a test can
pass an object literal instead of constructing a jsdom event and overriding
its read-only `timeStamp`:

```ts
gestures.handlers.pointerdown({
	pointerId: 1,
	clientX: 10,
	clientY: 10,
	timeStamp: 0,
});
```

## Behavior

All input funnels into the shared `animateTo` path on the viewport:

- **Drag** pans 1:1 (`duration: 0`); release adds a capped momentum glide
  scaled by `IViewportOptions.momentum` (`0` disables it).
- **Two-finger pinch** zooms geometrically around the midpoint — the world
  point under the fingers stays under them, referenced to the gesture start
  so tracking error can't compound.
- **Wheel** zooms toward the cursor with a short ease;
  **ctrl+wheel/trackpad pinch** tracks directly (`duration: 0`). Both are
  scaled by `IViewportOptions.wheelSensitivity`.
- **Safari trackpad pinches** arrive as proprietary GestureEvents and are
  handled separately (deferring to pointer events when any are active).

### Pointer capture is deferred

A pointer is captured only once it has moved ~4px from where it went down,
not on `pointerdown`. Capture retargets the compatibility mouse events, so
capturing immediately would send a pin's `click` to the captured element
and taps on a POI would stop activating it. Deferring leaves a tap's click
untouched, while the browser suppresses `click` after a real drag anyway —
so a drag starting on a pin pans without also activating it.

The threshold is a module constant, deliberately not an `IViewportOptions`
knob: it is tap/drag hit-testing, not an input-feel multiplier like
`wheelSensitivity` or `momentum` (see
[`useMapViewport`](./use-map-viewport.md) on why that surface stays narrow).
