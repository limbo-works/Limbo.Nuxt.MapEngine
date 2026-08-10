# `<MapPoint>`

Rendered internally by [`<MapEngine>`](./map-engine.md), one per entry in
`engine.points`. It is the positioned, clickable wrapper — the marker
visuals come from `<MapEngine>`'s `#point` slot.

## Props

| Prop     | Type      | Description                                                               |
| -------- | --------- | ------------------------------------------------------------------------- |
| `point`  | `IPoint`  | The point to position.                                                    |
| `engine` | `IEngine` | Used for `worldToScreen` positioning, click routing, and group filtering. |

## Behavior

- Tracks `viewport.worldToScreen(point.position)` reactively — pans,
  zooms, and container resizes all reposition it.
- A click calls `engine.activatePoint(point)`: first click selects, second
  click invokes `IEngineOptions.onActivatePoint`, if the consumer supplied
  one (SoW §3.3) — the component (and the engine) has no notion of what
  that does. Non-clickable points (`IPoint.clickable === false`) ignore
  clicks entirely (`pointer-events: none` via their pin styling plus the
  engine-side guard).
- While a group is selected, points outside
  `engine.getGroupPoints(group)` are hidden (`v-show`).

## Slot

Default slot with `{ point }` scope — this is where `<MapEngine>`
forwards its `#point` slot.

## CSS hooks & custom properties

- Classes: `c-map-point`, plus `--non-clickable` (`IPoint.clickable ===
false`, stacked under normal points) and `--highlighted`
  (`selectedAsDestination` or `selectedAsOrigin`, stacked above
  neighbors).
- The screen position is written as a **direct inline `transform`**
  (translate to the screen position, then by the anchor fraction), not
  as custom properties — per-frame inherited-variable writes would
  restyle the whole pin subtree every frame (see
  [Performance](./performance.md)). Don't set `transform` on
  `.c-map-point` yourself; put visual transforms (hover/selection
  scaling) on your own pin element inside the slot.
- `--anchor-x` / `--anchor-y`: which fraction of the marker's own box
  sits on the coordinate — `0.5 / 1` (bottom-center pin tip) unless
  overridden via the authored `IPoint.anchor`. Also used as the
  `transform-origin`, so a pin's hover/selection scaling can grow from
  the anchored spot via `transform-origin: inherit`.
