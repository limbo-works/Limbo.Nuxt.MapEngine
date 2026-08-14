<template>
	<div ref="root" class="c-map-viewport" v-on="props.gestures.handlers">
		<div class="c-map-viewport__inner" :style="innerStyle">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import type { IEngine, IGestures } from '../types';

// The recognizer is created by MapEngine, not here: gestures starting on a
// POI pin land on the points overlay, a sibling element, and both bind
// sites have to drive the same recognizer instance for a two-finger pinch
// spanning them to track as one gesture.
const props = defineProps<{ engine: IEngine; gestures: IGestures }>();
const root = useTemplateRef('root');

// transform/width/height are direct properties, not custom properties:
// custom properties inherit, so changing one here every frame forces a
// style recalc of every element in the map subtree — ruinous inside a
// consuming site with a large stylesheet (~20ms/frame against a ~1200-node
// SVG). Direct properties only invalidate this element. --viewport-scale
// stays a variable because MapLayer's stroke counter-scaling reads it, but
// it is quantized to ~3% multiplicative steps so a continuous zoom
// invalidates the subtree every few frames instead of every frame; the
// transform itself stays exact. A ≤1.5% stroke-width error is invisible,
// especially while the whole map is scaling.
const scaleStep = Math.log(1.03);

function quantizeScale(scale: number): number {
	return Math.exp(Math.round(Math.log(scale) / scaleStep) * scaleStep);
}

const innerStyle = computed(() => {
	const transform = props.engine.viewport.getTransform();

	return {
		'--viewport-scale': `${quantizeScale(transform.scale)}`,
		width: `${transform.width}px`,
		height: `${transform.height}px`,
		transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
	};
});

// This element is both the viewport's size reference and the recognizer's
// measuring stick — the overlay's own bindings are measured against it too,
// since the two elements share their geometry exactly.
onMounted(() => {
	props.engine.viewport.setElement(root.value);
	props.gestures.setElement(root.value);
});

onBeforeUnmount(() => {
	props.engine.viewport.setElement(null);
	props.gestures.setElement(null);
});
</script>

<style>
:where(.c-map-viewport) {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
	touch-action: none;

	& .c-map-viewport__inner {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		transform-origin: 0 0;
	}
}
</style>
