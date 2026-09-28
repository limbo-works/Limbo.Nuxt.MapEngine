<template>
	<div class="c-map-engine">
		<MapViewport :engine="engine">
			<div class="c-map-engine__layers">
				<MapLayer
					v-for="layer in engine.layers"
					:key="layer.name"
					:layer="layer"
					:engine="engine"
				/>
			</div>
		</MapViewport>

		<div class="c-map-engine__points">
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

		<!-- Zoom input over the UI overlay would otherwise fall through to the
		     browser's page zoom (sibling of the gesture bind sites, so the
		     recognizer never sees it) — see overlayHandlers. -->
		<div class="c-map-engine__overlay" v-on="gestures.overlayHandlers">
			<slot name="overlay"></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { IEngine } from '../types';

defineProps<{ engine: IEngine }>();
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

		/* overlayHandlers carries no pointer handlers (buttons, scrollers and
		   sheet drags keep native behavior), so a touch pinch starting on an
		   overlay control must be blocked here or the browser zooms the page. */
		touch-action: pan-x pan-y;
	}
}
</style>
