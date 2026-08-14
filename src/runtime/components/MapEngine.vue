<template>
	<div class="c-map-engine">
		<MapViewport ref="viewport" :engine="engine">
			<div class="c-map-engine__layers">
				<MapLayer
					v-for="layer in engine.layers"
					:key="layer.name"
					:layer="layer"
					:engine="engine"
				/>
			</div>
		</MapViewport>

		<div class="c-map-engine__points" @wheel.prevent="onPointsWheel">
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
import { useTemplateRef } from 'vue';
import type { IEngine } from '../types';

defineProps<{ engine: IEngine }>();

const viewport = useTemplateRef('viewport');

// Re-enters the viewport's own wheel handling for a wheel event that
// landed on the points overlay instead of the viewport itself — see the
// comment on MapViewport's defineExpose.
function onPointsWheel(event: WheelEvent) {
	viewport.value?.onWheel(event);
}
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
