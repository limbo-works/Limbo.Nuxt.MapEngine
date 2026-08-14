<template>
	<div class="c-map-engine">
		<MapViewport :engine="engine" :gestures="gestures">
			<div class="c-map-engine__layers">
				<MapLayer
					v-for="layer in engine.layers"
					:key="layer.name"
					:layer="layer"
					:engine="engine"
				/>
			</div>
		</MapViewport>

		<div class="c-map-engine__points" v-on="gestures.handlers">
			<MapPoint
				v-for="point in engine.points"
				:key="point.id"
				:point="point"
				:engine="engine"
			>
				<template #default="scope">
					<slot name="point" v-bind="scope"></slot>
				</template>
			</MapPoint>
		</div>

		<div class="c-map-engine__overlay">
			<slot name="overlay"></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
import useMapGestures from '../composables/useMapGestures';
import type { IEngine } from '../types';

const props = defineProps<{ engine: IEngine }>();

// One recognizer drives both bind sites. The points overlay is a sibling of
// the viewport rather than a descendant (so pins aren't double-transformed
// by the viewport's CSS transform), so gestures starting on a pin never
// reach the viewport's own bindings — binding the same handler set here is
// what makes dragging, pinching, and scroll-to-zoom work over a POI. Both
// sites must share one instance: a two-finger pinch can land one finger on
// a pin and the other on bare map, and the recognizer tracks them together.
const gestures = useMapGestures(props.engine.viewport);
</script>

<style>
:where(.c-map-engine) {
	position: relative;
	overflow: clip;
	background-color: #dfe0e2;
	user-select: none;

	/* Own stacking contexts: the points' internal z-index tiers (bare /
	   normal / highlighted) stay scoped inside their container, so no
	   point can ever paint above the UI overlay */
	& .c-map-engine__points {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		pointer-events: none;
	}

	& .c-map-engine__overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 2;
		pointer-events: none;
	}
}
</style>
