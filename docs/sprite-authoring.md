# Sprite authoring

How map SVGs must be produced for the engine's layering, scaling, and
stroke mechanics to work. This is the contract between whoever exports
the artwork (design/Figma) and the engine — most "the map looks wrong"
issues trace back to one of these rules.

The playground's sprite set (`playground/assets/map/`) is the reference
example for everything below.

## The shared canvas

**Every layer of one map is exported on the same canvas.** Layers are
not positioned relative to each other at runtime — each sprite is
stretched to the same box — so the base map, floor plans, parking,
routes, labels, and building highlights must all share one artboard size
and origin (the playground's is `22370 × 22370`). An element at the same
artboard position in two different exports lands at the same map
position.

The engine derives the world's size from the **largest** layer sprite's
own `width`/`height` attributes, and world-pixel coordinates
(`IPoint.position`, `zoomTo` targets) are read directly in those units —
measure a POI's position in the design file and use the numbers as-is.

## One well-formed root

Each sprite must be a single well-formed `<svg>…</svg>` root. The engine
parses the root tag's attributes with a regex, not a full XML parser —
keep attribute values quote-delimited and put nothing before the opening
`<svg>`. Root `width`/`height`/`viewBox` should match the shared canvas.

Sprites render inside a ShadowRoot, isolated from the site's stylesheet
— a sprite can't rely on site CSS, and site CSS can't restyle sprite
internals. Everything visual must be self-contained in the SVG (plus the
engine's own scale/stroke mechanics below).

## Stroke counter-scaling

Zooming scales the whole sprite, which would turn hairline strokes into
ribbons. The engine counter-scales them automatically:

- Elements with a `stroke` attribute get a screen-stable stroke width.
- Elements with an explicit `stroke-width` attribute keep their authored
  weight as the reference, counter-scaled the same way.

How strongly this counteracts zoom is the layer's `scaleFactor`
(authored in `useMapLayer`, not the SVG): `0` = strokes hold a constant
screen size, `1` = they scale with the map. In-between values blend.
Typical values from the playground: `0.05` for the base map's subtle
outlines, `0.7`–`0.9` for roads/routes/labels that should stay close to
constant.

**Author strokes as attributes** (`stroke="…"`, `stroke-width="…"`), not
inline `style` — the mechanics key off the attributes.

## Constant-size marks: the `scale_` id convention

Elements whose **geometry** (not just stroke) should resist zoom — dots,
entrance arrows, text labels drawn as paths — are marked by giving them
an `id` containing `scale_`:

```xml
<g id="scale_entrance-arrow-01">…</g>
<g id="scale_label-building-21">…</g>
```

Such elements counter-scale as a whole around a pivot:

- The pivot defaults to the layer's `scaleOrigin` option (`'center'`
  unless set).
- Strength defaults to the layer's `scaleFactor`.

Ids must be unique within the sprite (standard SVG rule) — suffix them
(`scale_ellipse-01`, `scale_ellipse-02`). Strokes _inside_ a `scale_`
element are left at their authored width, since the element itself
already counter-scales.

### Per-element overrides

A single sprite can mix marks that need different pivots or strengths —
e.g. a symmetric dot and a directional arrow that should shrink toward
its tip. Override per element, directly in the SVG:

```xml
<g
	id="scale_bus-stop"
	data-scale-origin="50% 140%"
	data-scale-factor="0.4"
>…</g>
```

- `data-scale-origin` — any CSS `transform-origin` value, replacing the
  layer default for this element.
- `data-scale-factor` — replaces the layer's counter-scale strength for
  this element (`0` = fully constant screen size).

These attributes survive export from Figma when authored on the layer
name → id path, or can be added in post.

## Layer files and naming

The engine puts no meaning in file names — every layer is authored
explicitly via `useMapLayer({ name, sprite, … })`. The playground's
conventions are still worth copying because the consuming code (and the
Herningsholm client) globs by them:

```
assets/map/
	layers/
		required/          always-visible layers
			0-base.svg
			1-entrances-inactive.svg
			floors/
				floor-0.svg      one per floor; suffix = IFloor.id
				floor-1.svg
		optional/          toggleable layers (become filter pills)
			0-routes.svg
			1-parking.svg
			3-entrances.svg
		hidden/            supporting layers with scale thresholds
			0-roads.svg
			1-labels.svg
	buildings/           one building-highlight sprite per building
		building-highlight-21.svg
		building-highlight-1A.svg
```

- The numeric prefix (`0-`, `1-`, …) is a paint-order hint for humans;
  actual stacking is push order onto `engine.layers` (first = bottom).
- `floor-<n>.svg` — the suffix becomes the `floor` option
  (`IFloor.id`).
- `building-highlight-<name>.svg` — `<name>` (lowercased) becomes the
  layer's `name` and must match the `buildings` entries on the points
  that light it up.

## Special-purpose layers

Two `kind` values give a layer engine-managed behavior; both are
"mostly hidden" layers shown via `forceVisible`:

- **`walking-routes`** — force-shown while pseudo-wayfinding has both an
  origin and a destination selected. Author the full route network in
  one sprite.
- **`building-highlight`** — one sprite per building, containing just
  that building's highlight shape (on the shared canvas, so it lands on
  the building). Force-shown while a point naming that building (via
  `IPoint.buildings`) is selected as destination or origin.

## Scale thresholds

Detail layers declare their zoom range in `useMapLayer`, not the SVG —
but the artwork should be drawn for its range: floor plans
(`minScale: 5.25` in the playground) can carry room-level detail; the
base layer visible at `scale 1` should not. The fade is a continuous
opacity ramp `scaleFeather` wide around each threshold, so neighboring
layers (e.g. `1-parking` for far zoom, `2-parking-active` for near) can
cross-fade by overlapping their ranges.

## Export checklist

- [ ] Same artboard size and origin for every layer of the map.
- [ ] Single `<svg>` root; root `width`/`height` match the canvas.
- [ ] Strokes as `stroke`/`stroke-width` attributes.
- [ ] Constant-size marks id'd with `scale_`, unique suffixes.
- [ ] Directional marks carry `data-scale-origin` (and
      `data-scale-factor` where needed).
- [ ] Floor sprites named/mapped to their `IFloor.id`.
- [ ] Building highlights: one sprite per building, named to match the
      points' `buildings` entries.
- [ ] No reliance on external CSS, fonts, or images — sprites are
      self-contained and style-isolated.
- [ ] Keep an eye on node count: sprites in the thousands of elements
      still render fine, but raster cost at deep zoom and load size grow
      with it. Flatten what doesn't need to be individually addressable.
