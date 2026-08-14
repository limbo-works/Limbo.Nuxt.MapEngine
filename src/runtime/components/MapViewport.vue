<template>
	<div
		ref="root"
		class="c-map-viewport"
		@pointerdown="onPointerDown"
		@pointermove="onPointerMove"
		@pointerup="onPointerUp"
		@pointercancel="onPointerUp"
		@wheel.prevent="onWheel"
		@gesturestart.prevent="onGestureStart"
		@gesturechange.prevent="onGestureChange"
		@gestureend.prevent="onGestureEnd"
	>
		<div class="c-map-viewport__inner" :style="innerStyle">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import { distance, midpoint } from '../utils/math';
import type { IVector, IEngine } from '../types';

const props = defineProps<{ engine: IEngine }>();
const root = useTemplateRef('root');

// Active gestures track the fingers 1:1 (duration 0 keeps them on the
// shared animateTo path); easing is reserved for wheel zoom and the
// momentum glide on release. Release speed is capped so a flick nudges
// the map rather than launching it.
const flingDuration = 600;
const flingDecay = 150;
const flingCurve = flingDuration / flingDecay;
const maxFlingSpeed = 2;
const maxFlingZoom = 0.0028;

const pointers = new Map<number, IVector>();

// Pinch positioning is referenced to the gesture start (world point under
// the start midpoint + start distance/scale) rather than accumulated per
// event, so tracking error can't compound.
let pinch: { world: IVector; distance: number; scale: number } | null = null;

// Safari doesn't synthesize ctrl+wheel for trackpad pinches — it fires
// proprietary GestureEvents carrying a scale relative to gesture start.
interface ISafariGestureEvent extends Event {
	scale: number;
	clientX: number;
	clientY: number;
}

let gesture: { world: IVector; scale: number; lastScale: number } | null = null;

const velocity: IVector = { x: 0, y: 0 };
let zoomVelocity = 0;
let gesturePoint: IVector = { x: 0, y: 0 };
let lastEventTime = 0;
let lastMoveTime = 0;
let lastPinchTime = 0;

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

onMounted(() => {
	props.engine.viewport.setElement(root.value);
});

onBeforeUnmount(() => {
	props.engine.viewport.setElement(null);
});

// Client coordinates -> screen-pixel space (relative to .c-map-viewport),
// the space worldToScreen/screenToWorld and the gesture math operate in
function toScreen(event: { clientX: number; clientY: number }): IVector {
	const rect = root.value?.getBoundingClientRect();

	return {
		x: event.clientX - (rect?.left ?? 0),
		y: event.clientY - (rect?.top ?? 0),
	};
}

function onPointerDown(event: PointerEvent) {
	try {
		root.value?.setPointerCapture(event.pointerId);
	} catch {
		// synthetic pointers (tests) can't be captured — panning still works
	}

	props.engine.viewport.stop();
	pointers.set(event.pointerId, toScreen(event));

	velocity.x = 0;
	velocity.y = 0;
	zoomVelocity = 0;
	lastEventTime = event.timeStamp;
	lastMoveTime = 0;

	pinch = pointers.size === 2 ? capturePinch() : null;
}

function capturePinch() {
	const [a, b] = [...pointers.values()];

	return {
		world: props.engine.viewport.screenToWorld(midpoint(a, b)),
		distance: distance(a, b),
		scale: props.engine.viewport.scale,
	};
}

function onPointerMove(event: PointerEvent) {
	const previous = pointers.get(event.pointerId);
	if (!previous) {
		return;
	}

	const position = toScreen(event);
	pointers.set(event.pointerId, position);

	if (pointers.size === 2 && pinch) {
		const other = [...pointers.entries()].find(
			([id]) => id !== event.pointerId
		)?.[1];

		if (!other) {
			return;
		}

		const nextMidpoint = midpoint(position, other);
		const nextDistance = distance(position, other);

		if (pinch.distance > 0 && nextDistance > 0) {
			props.engine.viewport.zoomTo(
				pinch.world,
				pinch.scale * (nextDistance / pinch.distance),
				{ origin: toNormalized(nextMidpoint), duration: 0 }
			);
		}

		const previousMidpoint = midpoint(previous, other);
		const previousDistance = distance(previous, other);

		trackVelocity(
			event.timeStamp,
			{
				x: nextMidpoint.x - previousMidpoint.x,
				y: nextMidpoint.y - previousMidpoint.y,
			},
			previousDistance > 0 && nextDistance > 0
				? Math.log(nextDistance / previousDistance)
				: 0
		);

		gesturePoint = nextMidpoint;
		lastPinchTime = event.timeStamp;
	} else if (pointers.size === 1) {
		const delta = {
			x: position.x - previous.x,
			y: position.y - previous.y,
		};

		props.engine.viewport.pan(delta, { duration: 0 });
		trackVelocity(event.timeStamp, delta, 0);
		gesturePoint = position;
	}
}

function onPointerUp(event: PointerEvent) {
	if (!pointers.delete(event.pointerId)) {
		return;
	}

	if (pointers.size === 2) {
		pinch = capturePinch();
	} else if (pointers.size === 1) {
		pinch = null;
	} else {
		release(event.timeStamp);
	}
}

// Exponentially smoothed over the last ~50ms so release momentum isn't
// dictated by a single (possibly jittery) event delta.
function trackVelocity(now: number, delta: IVector, zoom: number) {
	const elapsed = Math.min(Math.max(now - lastEventTime, 1), 100);
	const weight = 1 - Math.exp(-elapsed / 50);

	velocity.x += (delta.x / elapsed - velocity.x) * weight;
	velocity.y += (delta.y / elapsed - velocity.y) * weight;
	zoomVelocity += (zoom / elapsed - zoomVelocity) * weight;

	lastEventTime = now;
	lastMoveTime = now;
}

function release(now: number) {
	const { momentum } = props.engine.viewport;

	if (momentum <= 0 || now - lastMoveTime > 100) {
		return;
	}

	// Exponential decay has a closed-form travel distance, so the glide is
	// expressed as one animateTo tween instead of a per-frame simulation.
	const travel = flingDecay * (1 - Math.exp(-flingCurve)) * momentum;
	const speed = Math.hypot(velocity.x, velocity.y);
	const cap = speed > maxFlingSpeed ? maxFlingSpeed / speed : 1;
	const delta = {
		x: velocity.x * cap * travel,
		y: velocity.y * cap * travel,
	};
	const zoom =
		now - lastPinchTime < 100
			? Math.min(Math.max(zoomVelocity, -maxFlingZoom), maxFlingZoom) *
				travel
			: 0;

	if (Math.hypot(delta.x, delta.y) < 1 && Math.abs(zoom) < 0.001) {
		return;
	}

	const options = { duration: flingDuration, easing: flingEasing };

	if (zoom) {
		props.engine.viewport.zoomTo(
			props.engine.viewport.screenToWorld(gesturePoint),
			props.engine.viewport.scale * Math.exp(zoom),
			{
				...options,
				origin: toNormalized({
					x: gesturePoint.x + delta.x,
					y: gesturePoint.y + delta.y,
				}),
			}
		);
	} else {
		props.engine.viewport.pan(delta, options);
	}
}

function flingEasing(t: number): number {
	return (1 - Math.exp(-flingCurve * t)) / (1 - Math.exp(-flingCurve));
}

function toNormalized(point: IVector): IVector {
	const rect = root.value?.getBoundingClientRect();

	return {
		x: point.x / (rect?.width || 1),
		y: point.y / (rect?.height || 1),
	};
}

function onWheel(event: WheelEvent) {
	const sensitivity = props.engine.viewport.wheelSensitivity;
	const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;

	// Trackpad pinches arrive as ctrl+wheel (except in Safari, which uses
	// GestureEvents) — those track the physical gesture directly, while
	// discrete wheel ticks keep a short ease as their smoothing.
	if (event.ctrlKey) {
		props.engine.viewport.zoomBy(
			Math.exp(-delta * 0.01 * sensitivity),
			toScreen(event),
			{ duration: 0 }
		);
	} else {
		props.engine.viewport.zoomBy(
			Math.exp(-delta * 0.0015 * sensitivity),
			toScreen(event),
			{ duration: 250 }
		);
	}
}

// The gesture handlers only run for Safari trackpad pinches — touch
// pinches on iOS fire pointer events too and are handled there, so any
// tracked pointer means these must stay out of the way.
function onGestureStart(event: Event) {
	if (pointers.size > 0) {
		return;
	}

	const { clientX, clientY } = event as ISafariGestureEvent;
	const position = toScreen({ clientX, clientY });

	props.engine.viewport.stop();

	gesture = {
		world: props.engine.viewport.screenToWorld(position),
		scale: props.engine.viewport.scale,
		lastScale: 1,
	};

	velocity.x = 0;
	velocity.y = 0;
	zoomVelocity = 0;
	lastEventTime = event.timeStamp;
	lastMoveTime = 0;
	gesturePoint = position;
}

function onGestureChange(event: Event) {
	if (!gesture || pointers.size > 0) {
		return;
	}

	const { scale, clientX, clientY } = event as ISafariGestureEvent;
	const position = toScreen({ clientX, clientY });

	if (scale > 0) {
		props.engine.viewport.zoomTo(gesture.world, gesture.scale * scale, {
			origin: toNormalized(position),
			duration: 0,
		});

		trackVelocity(
			event.timeStamp,
			{ x: position.x - gesturePoint.x, y: position.y - gesturePoint.y },
			Math.log(scale / gesture.lastScale)
		);

		gesture.lastScale = scale;
	}

	gesturePoint = position;
	lastPinchTime = event.timeStamp;
}

function onGestureEnd(event: Event) {
	if (gesture && pointers.size === 0) {
		release(event.timeStamp);
	}

	gesture = null;
}

// The points layer renders as a sibling overlay above this element (so its
// manually-positioned pins aren't double-transformed by the viewport's own
// CSS transform) — a wheel event targeting a pin therefore never bubbles
// into the @wheel listener below. MapEngine forwards those events here so
// scroll-to-zoom keeps working while the cursor is over a pin.
defineExpose({ onWheel });
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
