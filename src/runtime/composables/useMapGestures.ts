import { distance, midpoint } from '../utils/math';
import type {
	IGestureOverlayWheelInput,
	IGesturePointerInput,
	IGestureScaleInput,
	IGestureWheelInput,
	IGestures,
	IVector,
	IViewport,
} from '../types';

// Active gestures track the fingers 1:1 (duration 0 keeps them on the
// shared animateTo path); easing is reserved for wheel zoom and the
// momentum glide on release. Release speed is capped so a flick nudges
// the map rather than launching it.
const flingDuration = 600;
const flingDecay = 150;
const flingCurve = flingDuration / flingDecay;
const maxFlingSpeed = 2;
const maxFlingZoom = 0.0028;

// Movement (in screen pixels) before a pointer is captured. Capture
// retargets the compatibility mouse events, so capturing on pointerdown
// would send a pin's `click` to the captured element instead of the pin,
// and taps on a POI would stop activating it. Deferring capture until the
// pointer has clearly started dragging leaves a tap's click untouched,
// while the browser suppresses click after a real drag anyway.
//
// Deliberately not an IViewportOptions knob: this is tap/drag hit-testing,
// not an input-feel multiplier like wheelSensitivity or momentum.
const captureThreshold = 4;

/**
 * Recognizes pan, pinch, wheel-zoom, and momentum from raw pointer input
 * and drives an IViewport with them.
 *
 * The element passed to `setElement` is only a measuring stick — pointer
 * positions are converted to screen-pixel space against its bounding rect,
 * and drags are captured to it. Events are free to originate elsewhere:
 * `MapEngine` binds this same handler set on both the viewport and the
 * points overlay (a sibling element of identical geometry), so a gesture
 * starting on a POI pin pans and zooms the map exactly like one starting
 * on bare map.
 *
 * Usage:
 *
 * const gestures = useMapGestures(engine.viewport);
 * onMounted(() => gestures.setElement(root.value));
 *
 * <div ref="root" v-on="gestures.handlers"></div>
 */
export default (viewport: IViewport): IGestures => {
	let element: HTMLElement | null = null;

	// Current screen-space position per active pointer, plus where each one
	// went down — the origin is what the capture threshold measures against,
	// so a slow drift past 4px captures the same as a fast flick does.
	const pointers = new Map<number, IVector>();
	const origins = new Map<number, IVector>();
	const captured = new Set<number>();

	// Pinch positioning is referenced to the gesture start (world point under
	// the start midpoint + start distance/scale) rather than accumulated per
	// event, so tracking error can't compound.
	let pinch: { world: IVector; distance: number; scale: number } | null =
		null;

	let gesture: { world: IVector; scale: number; lastScale: number } | null =
		null;

	const velocity: IVector = { x: 0, y: 0 };
	let zoomVelocity = 0;
	let gesturePoint: IVector = { x: 0, y: 0 };
	let lastEventTime = 0;
	let lastMoveTime = 0;
	let lastPinchTime = 0;

	function setElement(next: HTMLElement | null) {
		element = next;
	}

	// Client coordinates -> screen-pixel space (relative to the measured
	// element), the space worldToScreen/screenToWorld and the gesture math
	// operate in
	function toScreen(event: { clientX: number; clientY: number }): IVector {
		const rect = element?.getBoundingClientRect();

		return {
			x: event.clientX - (rect?.left ?? 0),
			y: event.clientY - (rect?.top ?? 0),
		};
	}

	function toNormalized(point: IVector): IVector {
		const rect = element?.getBoundingClientRect();

		return {
			x: point.x / (rect?.width || 1),
			y: point.y / (rect?.height || 1),
		};
	}

	function onPointerDown(event: IGesturePointerInput) {
		const position = toScreen(event);

		viewport.stop();
		pointers.set(event.pointerId, position);
		origins.set(event.pointerId, position);

		velocity.x = 0;
		velocity.y = 0;
		zoomVelocity = 0;
		lastEventTime = event.timeStamp;
		lastMoveTime = 0;

		pinch = pointers.size === 2 ? capturePinch() : null;
	}

	// Capture once the pointer has moved far enough to be a drag rather than
	// a tap — see captureThreshold.
	function tryCapture(pointerId: number, position: IVector) {
		if (captured.has(pointerId)) {
			return;
		}

		const origin = origins.get(pointerId);
		if (!origin || distance(origin, position) < captureThreshold) {
			return;
		}

		try {
			element?.setPointerCapture(pointerId);
			captured.add(pointerId);
		} catch {
			// synthetic pointers (tests) can't be captured — panning still works
		}
	}

	function capturePinch() {
		const [a, b] = [...pointers.values()];

		return {
			world: viewport.screenToWorld(midpoint(a, b)),
			distance: distance(a, b),
			scale: viewport.scale,
		};
	}

	function onPointerMove(event: IGesturePointerInput) {
		const previous = pointers.get(event.pointerId);
		if (!previous) {
			return;
		}

		const position = toScreen(event);
		pointers.set(event.pointerId, position);
		tryCapture(event.pointerId, position);

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
				viewport.zoomTo(
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

			viewport.pan(delta, { duration: 0 });
			trackVelocity(event.timeStamp, delta, 0);
			gesturePoint = position;
		}
	}

	function onPointerUp(event: IGesturePointerInput) {
		if (!pointers.delete(event.pointerId)) {
			return;
		}

		origins.delete(event.pointerId);
		captured.delete(event.pointerId);

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
		const { momentum } = viewport;

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
		const cappedZoom = Math.min(
			Math.max(zoomVelocity, -maxFlingZoom),
			maxFlingZoom
		);
		const zoom = now - lastPinchTime < 100 ? cappedZoom * travel : 0;

		if (Math.hypot(delta.x, delta.y) < 1 && Math.abs(zoom) < 0.001) {
			return;
		}

		const options = { duration: flingDuration, easing: flingEasing };

		if (zoom) {
			viewport.zoomTo(
				viewport.screenToWorld(gesturePoint),
				viewport.scale * Math.exp(zoom),
				{
					...options,
					origin: toNormalized({
						x: gesturePoint.x + delta.x,
						y: gesturePoint.y + delta.y,
					}),
				}
			);
		} else {
			viewport.pan(delta, options);
		}
	}

	function flingEasing(t: number): number {
		return (1 - Math.exp(-flingCurve * t)) / (1 - Math.exp(-flingCurve));
	}

	function onWheel(event: IGestureWheelInput) {
		event.preventDefault();

		const sensitivity = viewport.wheelSensitivity;
		const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;

		// Trackpad pinches arrive as ctrl+wheel (except in Safari, which uses
		// GestureEvents) — those track the physical gesture directly, while
		// discrete wheel ticks keep a short ease as their smoothing.
		if (event.ctrlKey) {
			viewport.zoomBy(
				Math.exp(-delta * 0.01 * sensitivity),
				toScreen(event),
				{ duration: 0 }
			);
		} else {
			viewport.zoomBy(
				Math.exp(-delta * 0.0015 * sensitivity),
				toScreen(event),
				{ duration: 250 }
			);
		}
	}

	// A ctrl+wheel is a trackpad pinch and never scrolls content, so it
	// always zooms the map; a plain wheel yields to any scroller between the
	// event target and the bind site that can actually consume it (a search
	// suggestion list, a group panel) and zooms the map otherwise.
	function onOverlayWheel(event: IGestureOverlayWheelInput) {
		if (!event.ctrlKey && canConsumeScroll(event)) {
			return;
		}

		onWheel(event);
	}

	function canConsumeScroll(event: IGestureOverlayWheelInput): boolean {
		const horizontal =
			event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
		let node = event.target instanceof Element ? event.target : null;

		while (node && node !== event.currentTarget) {
			const { overflowX, overflowY } = getComputedStyle(node);
			const overflow = horizontal ? overflowX : overflowY;
			const scrollable = horizontal
				? node.scrollWidth > node.clientWidth
				: node.scrollHeight > node.clientHeight;

			if ((overflow === 'auto' || overflow === 'scroll') && scrollable) {
				return true;
			}

			node = node.parentElement;
		}

		return false;
	}

	// The gesture handlers only run for Safari trackpad pinches — touch
	// pinches on iOS fire pointer events too and are handled there, so any
	// tracked pointer means these must stay out of the way.
	function onGestureStart(event: IGestureScaleInput) {
		event.preventDefault();

		if (pointers.size > 0) {
			return;
		}

		const position = toScreen(event);

		viewport.stop();

		gesture = {
			world: viewport.screenToWorld(position),
			scale: viewport.scale,
			lastScale: 1,
		};

		velocity.x = 0;
		velocity.y = 0;
		zoomVelocity = 0;
		lastEventTime = event.timeStamp;
		lastMoveTime = 0;
		gesturePoint = position;
	}

	function onGestureChange(event: IGestureScaleInput) {
		event.preventDefault();

		if (!gesture || pointers.size > 0) {
			return;
		}

		const position = toScreen(event);

		if (event.scale > 0) {
			viewport.zoomTo(gesture.world, gesture.scale * event.scale, {
				origin: toNormalized(position),
				duration: 0,
			});

			trackVelocity(
				event.timeStamp,
				{
					x: position.x - gesturePoint.x,
					y: position.y - gesturePoint.y,
				},
				Math.log(event.scale / gesture.lastScale)
			);

			gesture.lastScale = event.scale;
		}

		gesturePoint = position;
		lastPinchTime = event.timeStamp;
	}

	function onGestureEnd(event: IGestureScaleInput) {
		event.preventDefault();

		if (gesture && pointers.size === 0) {
			release(event.timeStamp);
		}

		gesture = null;
	}

	return {
		setElement,
		handlers: {
			pointerdown: onPointerDown,
			pointermove: onPointerMove,
			pointerup: onPointerUp,
			// A cancelled pointer ends the gesture the same way a lifted one
			// does — the recognizer has no separate cancellation state.
			pointercancel: onPointerUp,
			wheel: onWheel,
			gesturestart: onGestureStart,
			gesturechange: onGestureChange,
			gestureend: onGestureEnd,
		},
		overlayHandlers: {
			wheel: onOverlayWheel,
			gesturestart: onGestureStart,
			gesturechange: onGestureChange,
			gestureend: onGestureEnd,
		},
	};
};
