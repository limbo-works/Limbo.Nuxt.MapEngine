/**
 * The recognizer's handlers are typed against what they actually read
 * rather than against DOM event classes. Real PointerEvent/WheelEvent
 * instances satisfy these structurally, so templates bind them directly —
 * while a test can pass an object literal instead of constructing a jsdom
 * event and overriding its read-only timeStamp.
 */
export interface IGesturePointerInput {
	pointerId: number;
	clientX: number;
	clientY: number;
	timeStamp: number;
}

export interface IGestureWheelInput {
	clientX: number;
	clientY: number;
	deltaY: number;
	// 0 = pixels, 1 = lines (Firefox); anything else is treated as pixels.
	deltaMode: number;
	// Trackpad pinches arrive as ctrl+wheel everywhere except Safari.
	ctrlKey: boolean;
	preventDefault(): void;
}

/**
 * Safari doesn't synthesize ctrl+wheel for trackpad pinches — it fires
 * proprietary GestureEvents carrying a scale relative to gesture start.
 * TypeScript's DOM lib has no type for them, so the cast at the bind site
 * is unavoidable; this interface is what it casts to.
 */
export interface IGestureScaleInput {
	scale: number;
	clientX: number;
	clientY: number;
	timeStamp: number;
	preventDefault(): void;
}

/**
 * Keyed by DOM event name rather than `onPointerDown` style, so the whole
 * set spreads with `v-on="gestures.handlers"` — Vue normalizes the keys of
 * an object passed to `v-on` through `toHandlerKey`, which would turn
 * `onPointerDown` into a listener for an `onPointerDown` event. Adding a
 * handler here reaches every bind site without touching a template.
 */
export interface IGestureHandlers {
	pointerdown(event: IGesturePointerInput): void;
	pointermove(event: IGesturePointerInput): void;
	pointerup(event: IGesturePointerInput): void;
	pointercancel(event: IGesturePointerInput): void;
	wheel(event: IGestureWheelInput): void;
	gesturestart(event: IGestureScaleInput): void;
	gesturechange(event: IGestureScaleInput): void;
	gestureend(event: IGestureScaleInput): void;
}

export interface IGestures {
	// The element the recognizer measures against: pointer positions are
	// converted to screen-pixel space using its bounding rect, and drags are
	// captured to it. Events may originate from other elements (the points
	// overlay is a sibling of the viewport, not a descendant) — they are
	// still measured against this one.
	setElement(element: HTMLElement | null): void;
	handlers: IGestureHandlers;
}
