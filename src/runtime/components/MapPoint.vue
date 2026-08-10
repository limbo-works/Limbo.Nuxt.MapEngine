<template>
	<div
		ref="root"
		:class="[
			'c-map-point',
			{
				'c-map-point--hidden': !visible,
				'c-map-point--non-clickable': !point.clickable,
				'c-map-point--highlighted':
					point.selectedAsDestination || point.selectedAsOrigin,
			},
		]"
		:style="{
			'--anchor-x': point.anchor?.x,
			'--anchor-y': point.anchor?.y,
		}"
		@click="engine.activatePoint(point)"
	>
		<slot :point="point"></slot>
	</div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef, watchEffect } from 'vue';
import { isPointInGroup } from '../utils/points';
import type { IPoint, IEngine } from '../types';

const props = defineProps<{ point: IPoint; engine: IEngine }>();
const root = useTemplateRef('root');

// Visibility, in priority order:
//
// 1. Pseudo-wayfinding — once BOTH a destination and an origin are selected,
//    the map narrows to exactly those two points; everything else is hidden.
// 2. Otherwise a lone selected destination or origin is always shown, with zero
//    exceptions: no group filter, layer gate, or authored `visible` flag hides
//    it.
// 3. Otherwise an active group filters the map to its own points (SoW §3.5) —
//    members bypass their layer gate so a group reveals every point it contains,
//    even ones on hidden layers, and non-members are hidden. A point tied to a
//    layer (IPoint.layer) otherwise rides that layer's visibility, appearing and
//    disappearing with it (floor selection, toggle, scale range).
const visible = computed(() => {
	const { point, engine } = props;

	const hasDestination = engine.points.some((p) => p.selectedAsDestination);
	const hasOrigin = engine.points.some((p) => p.selectedAsOrigin);
	if (hasDestination && hasOrigin) {
		return point.selectedAsDestination || point.selectedAsOrigin;
	}

	if (point.selectedAsDestination || point.selectedAsOrigin) {
		return true;
	}

	const group = engine.selectedGroup;
	const inActiveGroup = group && isPointInGroup(point, group);

	return (
		point.visible &&
		(inActiveGroup ||
			point.layer === undefined ||
			engine.isLayerVisible(point.layer)) &&
		(!group || isPointInGroup(point, group))
	);
});

// watchEffect (rather than a fixed list of watched sources) auto-tracks
// everything worldToScreen actually reads — position, scale, center, and
// viewport size — so a resize repositions points the same as a pan/zoom
// does, without a matching manual dependency to remember to add. Post
// flush so the template ref is populated on the very first run, covering
// what a separate onMounted call used to.
watchEffect(() => setPosition(), { flush: 'post' });

// Written as a direct transform, not --position-x/y custom properties —
// custom properties inherit, so writing them per frame would invalidate the
// styles of the whole pin subtree (× every point, every frame); a transform
// only invalidates this element.
function setPosition() {
	const position = props.engine.viewport.worldToScreen(props.point.position);
	const anchorX = (props.point.anchor?.x ?? 0.5) * -100;
	const anchorY = (props.point.anchor?.y ?? 1) * -100;
	root.value?.style.setProperty(
		'transform',
		`translate(${position.x}px, ${position.y}px) translate(${anchorX}%, ${anchorY}%)`
	);
}
</script>

<style>
:where(.c-map-point) {
	position: absolute;
	top: 0;
	left: 0;

	/* Points fade rather than pop when their visibility changes (group filter,
	   floor/layer reveal, selection) — see .c-map-point--hidden. */
	transition: opacity 200ms ease;

	/* Stacking tiers: decorative bare icons sit under normal points, and
	   the highlighted point (destination or wayfinding origin) wins over
	   overlapping neighbors */
	z-index: 1;

	&.c-map-point--non-clickable {
		z-index: 0;
	}

	&.c-map-point--highlighted {
		z-index: 2;
	}

	/* .c-map-engine__points disables pointer-events so pans pass through
	   to the map — re-enable them on the points themselves */
	pointer-events: auto;

	transform-origin: calc(var(--anchor-x, 0.5) * 100%)
		calc(var(--anchor-y, 1) * 100%);
}

:where(.c-map-point--hidden) {
	opacity: 0;
	pointer-events: none;

	/* Fade opacity out, then flip visibility (removing it from hit-testing and
	   the a11y tree) only once the fade has finished. */
	visibility: hidden;
	transition:
		opacity 200ms ease,
		visibility 0s linear 200ms;
}
</style>
