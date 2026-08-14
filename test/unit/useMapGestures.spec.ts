import { afterEach, describe, expect, it, vi } from 'vitest';
import useMapGestures from '../../src/runtime/composables/useMapGestures';
import type { IGestures } from '../../src/runtime/types';
import { makeEngine } from '../utils';

/**
 * The recognizer needs no component and no real events — it measures against
 * whatever element it is given (a detached div reports an all-zero rect, so
 * client coordinates pass through as screen coordinates) and its handlers
 * take plain objects.
 */
function makeGestures() {
	const { engine } = makeEngine();
	const element = document.createElement('div');
	element.setPointerCapture = vi.fn();
	element.releasePointerCapture = vi.fn();

	const gestures = useMapGestures(engine.viewport);
	gestures.setElement(element);

	return { gestures, viewport: engine.viewport, element };
}

function pointer(
	overrides: Partial<{
		pointerId: number;
		clientX: number;
		clientY: number;
		timeStamp: number;
	}> = {}
) {
	return {
		pointerId: 1,
		clientX: 0,
		clientY: 0,
		timeStamp: 0,
		...overrides,
	};
}

function wheel(
	overrides: Partial<{
		clientX: number;
		clientY: number;
		deltaY: number;
		deltaMode: number;
		ctrlKey: boolean;
	}> = {}
) {
	return {
		clientX: 0,
		clientY: 0,
		deltaY: 0,
		deltaMode: 0,
		ctrlKey: false,
		preventDefault: vi.fn(),
		...overrides,
	};
}

function scale(
	overrides: Partial<{
		scale: number;
		clientX: number;
		clientY: number;
		timeStamp: number;
	}> = {}
) {
	return {
		scale: 1,
		clientX: 0,
		clientY: 0,
		timeStamp: 0,
		preventDefault: vi.fn(),
		...overrides,
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('useMapGestures', () => {
	describe('pan', () => {
		it('freezes a running animation on pointerdown', () => {
			const { gestures, viewport } = makeGestures();
			const stop = vi.spyOn(viewport, 'stop');

			gestures.handlers.pointerdown(
				pointer({ clientX: 10, clientY: 10 })
			);

			expect(stop).toHaveBeenCalled();
		});

		it('pans 1:1 with a single-pointer drag', () => {
			const { gestures, viewport } = makeGestures();
			const pan = vi.spyOn(viewport, 'pan');

			gestures.handlers.pointerdown(
				pointer({ clientX: 10, clientY: 10 })
			);
			gestures.handlers.pointermove(
				pointer({ clientX: 30, clientY: 20 })
			);

			expect(pan).toHaveBeenCalledWith({ x: 20, y: 10 }, { duration: 0 });
		});

		it('ignores moves from untracked pointers', () => {
			const { gestures, viewport } = makeGestures();
			const pan = vi.spyOn(viewport, 'pan');

			gestures.handlers.pointermove(
				pointer({ clientX: 30, clientY: 20 })
			);

			expect(pan).not.toHaveBeenCalled();
		});
	});

	describe('pointer capture', () => {
		it('does not capture a pointer that has barely moved', () => {
			const { gestures, element } = makeGestures();

			gestures.handlers.pointerdown(
				pointer({ clientX: 10, clientY: 10 })
			);
			gestures.handlers.pointermove(
				pointer({ clientX: 12, clientY: 11 })
			);

			// Capturing here would retarget the compatibility mouse events and
			// a tap on a POI pin would stop firing the pin's own click.
			expect(element.setPointerCapture).not.toHaveBeenCalled();
		});

		it('captures once the pointer passes the drag threshold', () => {
			const { gestures, element } = makeGestures();

			gestures.handlers.pointerdown(
				pointer({ clientX: 10, clientY: 10 })
			);
			gestures.handlers.pointermove(
				pointer({ clientX: 20, clientY: 10 })
			);

			expect(element.setPointerCapture).toHaveBeenCalledWith(1);
		});

		it('captures a pointer only once across a long drag', () => {
			const { gestures, element } = makeGestures();

			gestures.handlers.pointerdown(pointer({ clientX: 0, clientY: 0 }));
			for (let step = 1; step <= 5; step++) {
				gestures.handlers.pointermove(pointer({ clientX: step * 20 }));
			}

			expect(element.setPointerCapture).toHaveBeenCalledTimes(1);
		});

		it('measures the threshold from where the pointer went down', () => {
			const { gestures, element } = makeGestures();

			// 1px steps: every individual step is far under the threshold, so
			// only the distance from the pointerdown position can trip it
			gestures.handlers.pointerdown(pointer({ clientX: 0, clientY: 0 }));
			gestures.handlers.pointermove(pointer({ clientX: 1 }));
			gestures.handlers.pointermove(pointer({ clientX: 2 }));
			gestures.handlers.pointermove(pointer({ clientX: 3 }));
			expect(element.setPointerCapture).not.toHaveBeenCalled();

			gestures.handlers.pointermove(pointer({ clientX: 4 }));
			expect(element.setPointerCapture).toHaveBeenCalledWith(1);
		});

		it('starts a fresh threshold for a later gesture', () => {
			const { gestures, element } = makeGestures();

			gestures.handlers.pointerdown(pointer({ clientX: 0 }));
			gestures.handlers.pointermove(pointer({ clientX: 40 }));
			gestures.handlers.pointerup(pointer({ clientX: 40 }));

			gestures.handlers.pointerdown(pointer({ clientX: 100 }));
			gestures.handlers.pointermove(pointer({ clientX: 101 }));

			expect(element.setPointerCapture).toHaveBeenCalledTimes(1);
		});
	});

	describe('pinch', () => {
		it('zooms geometrically around the pinch midpoint', () => {
			const { gestures, viewport } = makeGestures();
			const zoomTo = vi.spyOn(viewport, 'zoomTo');

			gestures.handlers.pointerdown(
				pointer({ pointerId: 1, clientX: 100, clientY: 100 })
			);
			gestures.handlers.pointerdown(
				pointer({ pointerId: 2, clientX: 200, clientY: 100 })
			);
			gestures.handlers.pointermove(
				pointer({ pointerId: 1, clientX: 50, clientY: 100 })
			);

			expect(zoomTo).toHaveBeenCalledTimes(1);
			const [, next, options] = zoomTo.mock.calls[0];
			// Fingers moved from 100px to 150px apart: 1.5x the pinch-start scale
			expect(next).toBeCloseTo(1.5);
			expect(options?.duration).toBe(0);
		});
	});

	describe('momentum', () => {
		function flick(gestures: IGestures) {
			gestures.handlers.pointerdown(
				pointer({ clientX: 10, clientY: 10, timeStamp: 1000 })
			);
			for (let step = 1; step <= 3; step++) {
				gestures.handlers.pointermove(
					pointer({
						clientX: 10 + step * 20,
						clientY: 10,
						timeStamp: 1000 + step * 16,
					})
				);
			}
			gestures.handlers.pointerup(
				pointer({ clientX: 70, clientY: 10, timeStamp: 1050 })
			);
		}

		it('glides on after a fast drag release', () => {
			const { gestures, viewport } = makeGestures();
			const pan = vi.spyOn(viewport, 'pan');

			flick(gestures);

			const lastCall = pan.mock.calls.at(-1)!;
			expect(lastCall[0].x).toBeGreaterThan(1);
			expect(lastCall[1]?.duration).toBe(600);
		});

		it('does not glide when momentum is disabled', () => {
			const { gestures, viewport } = makeGestures();
			viewport.momentum = 0;
			const pan = vi.spyOn(viewport, 'pan');

			flick(gestures);

			for (const call of pan.mock.calls) {
				expect(call[1]?.duration).toBe(0);
			}
		});

		it('does not glide after a pause before release', () => {
			const { gestures, viewport } = makeGestures();
			const pan = vi.spyOn(viewport, 'pan');

			gestures.handlers.pointerdown(
				pointer({ clientX: 10, clientY: 10, timeStamp: 1000 })
			);
			gestures.handlers.pointermove(
				pointer({ clientX: 50, clientY: 10, timeStamp: 1016 })
			);
			gestures.handlers.pointerup(
				pointer({ clientX: 50, clientY: 10, timeStamp: 1500 })
			);

			expect(pan).toHaveBeenCalledTimes(1);
			expect(pan.mock.calls[0][1]?.duration).toBe(0);
		});
	});

	describe('wheel', () => {
		it('smooths discrete wheel ticks with a short ease', () => {
			const { gestures, viewport } = makeGestures();
			const zoomBy = vi.spyOn(viewport, 'zoomBy');

			gestures.handlers.wheel(
				wheel({ deltaY: -100, clientX: 100, clientY: 50 })
			);

			const [factor, origin, options] = zoomBy.mock.calls[0];
			// exp(100 * 0.0015 * wheelSensitivity 0.5)
			expect(factor).toBeCloseTo(Math.exp(0.075));
			expect(origin).toEqual({ x: 100, y: 50 });
			expect(options?.duration).toBe(250);
		});

		it('tracks trackpad pinches (ctrl+wheel) directly', () => {
			const { gestures, viewport } = makeGestures();
			const zoomBy = vi.spyOn(viewport, 'zoomBy');

			gestures.handlers.wheel(wheel({ deltaY: -100, ctrlKey: true }));

			const [factor, , options] = zoomBy.mock.calls[0];
			expect(factor).toBeCloseTo(Math.exp(0.5));
			expect(options?.duration).toBe(0);
		});

		it('scales line-mode wheel deltas', () => {
			const { gestures, viewport } = makeGestures();
			const zoomBy = vi.spyOn(viewport, 'zoomBy');

			gestures.handlers.wheel(wheel({ deltaY: -3, deltaMode: 1 }));

			const [factor] = zoomBy.mock.calls[0];
			expect(factor).toBeCloseTo(Math.exp(3 * 16 * 0.0015 * 0.5));
		});

		it('prevents the page from scrolling', () => {
			const { gestures } = makeGestures();
			const event = wheel({ deltaY: -100 });

			gestures.handlers.wheel(event);

			expect(event.preventDefault).toHaveBeenCalled();
		});
	});

	describe('Safari gestures', () => {
		it('handles gesture events when no pointers are active', () => {
			const { gestures, viewport } = makeGestures();
			const zoomTo = vi.spyOn(viewport, 'zoomTo');

			gestures.handlers.gesturestart(
				scale({ scale: 1, clientX: 100, clientY: 100 })
			);
			gestures.handlers.gesturechange(
				scale({ scale: 2, clientX: 100, clientY: 100 })
			);

			const [, next, options] = zoomTo.mock.calls[0];
			expect(next).toBeCloseTo(2);
			expect(options?.duration).toBe(0);
		});

		it('defers to pointer events over Safari gestures', () => {
			const { gestures, viewport } = makeGestures();
			const zoomTo = vi.spyOn(viewport, 'zoomTo');

			gestures.handlers.pointerdown(
				pointer({ clientX: 10, clientY: 10 })
			);
			gestures.handlers.gesturestart(
				scale({ scale: 1, clientX: 100, clientY: 100 })
			);
			gestures.handlers.gesturechange(
				scale({ scale: 2, clientX: 100, clientY: 100 })
			);

			expect(zoomTo).not.toHaveBeenCalled();
		});
	});

	describe('element', () => {
		it('measures against the element it was given', () => {
			const { gestures, viewport, element } = makeGestures();
			const pan = vi.spyOn(viewport, 'pan');

			element.getBoundingClientRect = () =>
				({ left: 100, top: 50, width: 800, height: 600 }) as DOMRect;

			gestures.handlers.pointerdown(
				pointer({ clientX: 110, clientY: 60 })
			);
			gestures.handlers.pointermove(
				pointer({ clientX: 130, clientY: 70 })
			);

			// The rect offset cancels out of the delta, but the gesture is
			// tracked in the element's own screen space either way
			expect(pan).toHaveBeenCalledWith({ x: 20, y: 10 }, { duration: 0 });
		});
	});
});
