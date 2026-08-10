import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import MapViewport from '../../src/runtime/components/MapViewport.vue';
import type { IEngine } from '../../src/runtime/types';
import { triggerResize } from '../mocks';
import { fireGesture, firePointer, makeEngine } from '../utils';

function mountViewport(engine: IEngine) {
	const wrapper = mount(MapViewport, { props: { engine } });
	return { wrapper, root: wrapper.element };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('MapViewport', () => {
	it('registers its element with the viewport on mount and clears it on unmount', () => {
		const { engine } = makeEngine();
		const setElement = vi.spyOn(engine.viewport, 'setElement');

		const { wrapper } = mountViewport(engine);
		expect(setElement).toHaveBeenCalledWith(wrapper.element);

		wrapper.unmount();
		expect(setElement).toHaveBeenLastCalledWith(null);
	});

	it('feeds element resizes into the viewport size', () => {
		const { engine } = makeEngine();
		const { root } = mountViewport(engine);

		triggerResize(root, { width: 1024, height: 768 });

		expect(engine.viewport.size).toEqual({ width: 1024, height: 768 });
	});

	it('exposes the viewport transform as inline styles', () => {
		const { engine } = makeEngine();
		const { wrapper } = mountViewport(engine);

		const style = wrapper
			.find('.c-map-viewport__inner')
			.attributes('style');
		expect(style).toContain('--viewport-scale: 1');
		expect(style).toContain('width: 800px');
		expect(style).toContain('scale(1)');
	});

	it('freezes a running animation on pointerdown', () => {
		const { engine } = makeEngine();
		const stop = vi.spyOn(engine.viewport, 'stop');
		const { root } = mountViewport(engine);

		firePointer(root, 'pointerdown', { clientX: 10, clientY: 10 });

		expect(stop).toHaveBeenCalled();
	});

	it('pans 1:1 with a single-pointer drag', () => {
		const { engine } = makeEngine();
		const pan = vi.spyOn(engine.viewport, 'pan');
		const { root } = mountViewport(engine);

		firePointer(root, 'pointerdown', { clientX: 10, clientY: 10 });
		firePointer(root, 'pointermove', { clientX: 30, clientY: 20 });

		expect(pan).toHaveBeenCalledWith({ x: 20, y: 10 }, { duration: 0 });
	});

	it('ignores moves from untracked pointers', () => {
		const { engine } = makeEngine();
		const pan = vi.spyOn(engine.viewport, 'pan');
		const { root } = mountViewport(engine);

		firePointer(root, 'pointermove', { clientX: 30, clientY: 20 });

		expect(pan).not.toHaveBeenCalled();
	});

	it('zooms geometrically around the pinch midpoint', () => {
		const { engine } = makeEngine();
		const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
		const { root } = mountViewport(engine);

		firePointer(root, 'pointerdown', {
			pointerId: 1,
			clientX: 100,
			clientY: 100,
		});
		firePointer(root, 'pointerdown', {
			pointerId: 2,
			clientX: 200,
			clientY: 100,
		});
		firePointer(root, 'pointermove', {
			pointerId: 1,
			clientX: 50,
			clientY: 100,
		});

		expect(zoomTo).toHaveBeenCalledTimes(1);
		const [, scale, options] = zoomTo.mock.calls[0];
		// Fingers moved from 100px to 150px apart: 1.5x the pinch-start scale
		expect(scale).toBeCloseTo(1.5);
		expect(options?.duration).toBe(0);
	});

	it('glides on after a fast drag release', () => {
		const { engine } = makeEngine();
		const pan = vi.spyOn(engine.viewport, 'pan');
		const { root } = mountViewport(engine);

		firePointer(root, 'pointerdown', {
			clientX: 10,
			clientY: 10,
			timeStamp: 1000,
		});
		for (let step = 1; step <= 3; step++) {
			firePointer(root, 'pointermove', {
				clientX: 10 + step * 20,
				clientY: 10,
				timeStamp: 1000 + step * 16,
			});
		}
		firePointer(root, 'pointerup', {
			clientX: 70,
			clientY: 10,
			timeStamp: 1050,
		});

		const lastCall = pan.mock.calls.at(-1)!;
		expect(lastCall[0].x).toBeGreaterThan(1);
		expect(lastCall[1]?.duration).toBe(600);
	});

	it('does not glide when momentum is disabled', () => {
		const { engine } = makeEngine();
		engine.viewport.momentum = 0;
		const pan = vi.spyOn(engine.viewport, 'pan');
		const { root } = mountViewport(engine);

		firePointer(root, 'pointerdown', {
			clientX: 10,
			clientY: 10,
			timeStamp: 1000,
		});
		for (let step = 1; step <= 3; step++) {
			firePointer(root, 'pointermove', {
				clientX: 10 + step * 20,
				clientY: 10,
				timeStamp: 1000 + step * 16,
			});
		}
		firePointer(root, 'pointerup', {
			clientX: 70,
			clientY: 10,
			timeStamp: 1050,
		});

		for (const call of pan.mock.calls) {
			expect(call[1]?.duration).toBe(0);
		}
	});

	it('does not glide after a pause before release', () => {
		const { engine } = makeEngine();
		const pan = vi.spyOn(engine.viewport, 'pan');
		const { root } = mountViewport(engine);

		firePointer(root, 'pointerdown', {
			clientX: 10,
			clientY: 10,
			timeStamp: 1000,
		});
		firePointer(root, 'pointermove', {
			clientX: 50,
			clientY: 10,
			timeStamp: 1016,
		});
		firePointer(root, 'pointerup', {
			clientX: 50,
			clientY: 10,
			timeStamp: 1500,
		});

		expect(pan).toHaveBeenCalledTimes(1);
		expect(pan.mock.calls[0][1]?.duration).toBe(0);
	});

	it('smooths discrete wheel ticks with a short ease', () => {
		const { engine } = makeEngine();
		const zoomBy = vi.spyOn(engine.viewport, 'zoomBy');
		const { root } = mountViewport(engine);

		root.dispatchEvent(
			new WheelEvent('wheel', {
				deltaY: -100,
				deltaMode: 0,
				clientX: 100,
				clientY: 50,
				cancelable: true,
			})
		);

		const [factor, origin, options] = zoomBy.mock.calls[0];
		// exp(100 * 0.0015 * wheelSensitivity 0.5)
		expect(factor).toBeCloseTo(Math.exp(0.075));
		expect(origin).toEqual({ x: 100, y: 50 });
		expect(options?.duration).toBe(250);
	});

	it('tracks trackpad pinches (ctrl+wheel) directly', () => {
		const { engine } = makeEngine();
		const zoomBy = vi.spyOn(engine.viewport, 'zoomBy');
		const { root } = mountViewport(engine);

		root.dispatchEvent(
			new WheelEvent('wheel', {
				deltaY: -100,
				deltaMode: 0,
				ctrlKey: true,
				cancelable: true,
			})
		);

		const [factor, , options] = zoomBy.mock.calls[0];
		expect(factor).toBeCloseTo(Math.exp(0.5));
		expect(options?.duration).toBe(0);
	});

	it('scales line-mode wheel deltas', () => {
		const { engine } = makeEngine();
		const zoomBy = vi.spyOn(engine.viewport, 'zoomBy');
		const { root } = mountViewport(engine);

		root.dispatchEvent(
			new WheelEvent('wheel', {
				deltaY: -3,
				deltaMode: 1,
				cancelable: true,
			})
		);

		const [factor] = zoomBy.mock.calls[0];
		expect(factor).toBeCloseTo(Math.exp(3 * 16 * 0.0015 * 0.5));
	});

	it('handles Safari gesture events when no pointers are active', () => {
		const { engine } = makeEngine();
		const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
		const { root } = mountViewport(engine);

		fireGesture(root, 'gesturestart', {
			scale: 1,
			clientX: 100,
			clientY: 100,
		});
		fireGesture(root, 'gesturechange', {
			scale: 2,
			clientX: 100,
			clientY: 100,
		});

		const [, scale, options] = zoomTo.mock.calls[0];
		expect(scale).toBeCloseTo(2);
		expect(options?.duration).toBe(0);
	});

	it('defers to pointer events over Safari gestures', () => {
		const { engine } = makeEngine();
		const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
		const { root } = mountViewport(engine);

		firePointer(root, 'pointerdown', { clientX: 10, clientY: 10 });
		fireGesture(root, 'gesturestart', {
			scale: 1,
			clientX: 100,
			clientY: 100,
		});
		fireGesture(root, 'gesturechange', {
			scale: 2,
			clientX: 100,
			clientY: 100,
		});

		expect(zoomTo).not.toHaveBeenCalled();
	});
});
