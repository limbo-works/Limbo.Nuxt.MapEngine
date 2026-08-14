# Domain language

The vocabulary this codebase uses for the map itself. Use these words in
code, comments, commits, and issues; when a term here and the code
disagree, the code is right and this file needs updating.

`CLAUDE.md` covers architecture and working practice; the
[scope of work](./scope-of-work.md) is the product spec. This file is only
about what the nouns mean.

## The map

**Engine** — the single reactive root (`IEngine`, from `useMapEngine`)
holding every other object: the viewport, layers, points, groups, floors,
and the selection actions over them. Passed down as a prop, never
provided/injected.

**Viewport** — the pan/zoom state (`IViewport`). Owns `center`, `scale`,
and all motion; owns no input handling. Three coordinate spaces meet here:

- **World-pixel space** — the reference layer's native SVG units.
  `ILayer.position` and `IPoint.position` live here.
- **Normalized space** — `viewport.center` in `[0, 1]` of the world,
  independent of world size, stable enough to round-trip through a URL.
- **Screen-pixel space** — pixels relative to `.c-map-viewport`.

**Cover-fit** — the baseline `viewport.scale = 1`: the smallest scale that
fully covers the viewport. `scale` is always a multiplier on top of it,
never an absolute zoom.

**Recognizer** — `useMapGestures`. Turns raw pointer, wheel, and Safari
GestureEvent input into viewport motion. Distinct from the viewport: the
viewport knows how to move, the recognizer decides when and how far. One
instance is shared across every element that accepts input.

**Measuring element** — the element a recognizer converts client
coordinates against (`gestures.setElement`). Not the same idea as "the
element events come from": input arrives from several elements and is
always measured against this one.

**Capture threshold** — the distance a pointer must travel before the
recognizer captures it (~4px). Below it the gesture is still a **tap**;
past it, a **drag**. The distinction exists because pointer capture
retargets `click`, which would otherwise break POI taps.

## What's on the map

**Layer** — one SVG sprite drawn into the world (`ILayer`), rendered
inside a ShadowRoot. Visible per its own `visible`/`forceVisible` flags,
its `floor`, and its sprite's scale range.

**Sprite** — the parsed SVG behind a layer (`ISprite`): root attributes,
children, and the scale thresholds that fade it in and out.

**Scale feather** — the zoom band over which a layer fades rather than
popping, either side of its `minScale`/`maxScale`.

**Point** / **POI** — a marked place (`IPoint`). "Point" in code, "POI" in
prose and the scope of work; they mean the same thing.

**Clickable** — whether a point takes part in selection, search, and
grouping. Authored, not derived. Non-clickable points are the scope of
work's **bare icons**: decorative markers with no content behind them.

**Content** — a point's consumer-supplied payload (`IPoint.content`),
opaque to the engine. The engine never reads its shape; what activating a
point _does_ is the consumer's `onActivatePoint`.

**Group** — an author-defined set of points (`IGroup`) surfaced as a
filter pill. Selecting one frames its points and filters the map to them.

**Floor** — a building level (`IFloor`). Layers reference one by id; a
layer with no floor shows on every floor. **Available floors** are the
subset in scale range at the current zoom.

## Selection

**Destination** — the selected point (`IPoint.selectedAsDestination`).
The single source of truth for "this POI is highlighted"; there is
deliberately no parallel `engine.selectedPoint` field.

**Origin** — the "where are you now?" point of pseudo-wayfinding
(`IPoint.selectedAsOrigin`).

**Pseudo-wayfinding** — showing a destination and an origin together,
framing both and revealing the walking-routes layer. Not real routing: no
path is computed.

**Reveal** — force-showing a layer so a selected point isn't
selected-but-hidden, reverted when the selection changes.

**Building highlight** — a layer matched to a point by name
(`IPoint.buildings`), shown while that point is selected as destination or
origin.
