# `useMapFloor`

```ts
const floor = useMapFloor(options: IFloorOptions);
engine.floors.push(floor);
```

Creates one `IFloor` (a building floor, #5). Push the result onto
`engine.floors` yourself — the engine doesn't create floors on your
behalf, and **the order you push them in is the floor switcher's display
order** (see `engine.getAvailableFloors()` below).

## Options (`IFloorOptions`)

| Option  | Type     | Default    | Description                                                                                                                                |
| ------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`    | `string` | _required_ | Stable, unique identifier — referenced by `ILayerOptions.floor`, `engine.selectedFloor`, and `useMapUrlSync`'s `floor` param.              |
| `label` | `string` | _required_ | Display label for the floor switcher, e.g. `"st"` for the ground floor or `"2"` for the second floor. Purely presentational to the engine. |

Every field is required — there's no runtime-managed state on `IFloor`
beyond what's authored here (same as `IGroup`). Selection state
(`engine.selectedFloor`) lives on the engine, not the floor object.

## Related engine behavior

- `ILayer.floor` (`ILayerOptions.floor`) is a `string` referencing
  `IFloor.id`. A layer with no `floor` is shown regardless of the
  selected floor.
- `engine.getAvailableFloors()` returns the subset of `engine.floors`
  that some layer currently references _and_ is in-range at the current
  `viewport.scale` (via that layer's `sprite.minScale`) — in `engine.floors`'
  authored order, not layer-push order or numeric sorting. See
  [`useMapEngine`](./use-map-engine.md).
