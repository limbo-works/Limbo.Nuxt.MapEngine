# `useMapGroup`

```ts
const group = useMapGroup(options: IGroupOptions);
engine.groups.push(group);
```

Creates one `IGroup` (a cross-layer POI filter, SoW §3.5 — e.g. "Cardboard"
grouping waste-sorting POIs across the campus and multiple buildings).
Push the result onto `engine.groups` yourself.

## Options (`IGroupOptions`)

| Option  | Type     | Default    | Description                                                                                                                                                                                       |
| ------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`    | `string` | _required_ | Stable, unique identifier — referenced by `IPointOptions.groups`, `engine.selectedGroup`, and `useMapUrlSync`'s `group` param.                                                                    |
| `label` | `string` | _required_ | Display name for the group's filter pill, e.g. `"Cardboard"`. The pill's POI count (SoW §3.5: `"Cardboard (15)"`) is derived from `engine.getGroupPoints(group).length`, not stored on the group. |
| `color` | `string` | _required_ | CSS color for the group's filter pill.                                                                                                                                                            |

Every field is required — there's no runtime-managed state on `IGroup`
beyond what's authored here (unlike `IPoint`/`ILayer`, which each have
runtime-only fields). Selection state (`engine.selectedGroup`) lives on
the engine, not the group object.
