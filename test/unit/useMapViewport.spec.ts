import { describe, expect, it } from 'vitest';
import useMapViewport from '../../src/runtime/composables/useMapViewport';
import type { IViewportOptions } from '../../src/runtime/types';
import { frame, triggerResize } from '../mocks';
import { makeLayer, svgSprite, withSetup } from '../utils';

const linear = (t: number) => t;

/**
 * 1000x1000 world in an 800x600 viewport: cover-fit base scale is
 * max(800/1000, 600/1000) = 0.8 everywhere below.
 */
function makeViewport(options: IViewportOptions = {}) {
	const { result: viewport, wrapper } = withSetup(() =>
		useMapViewport({ worldSize: { width: 1000, height: 1000 }, ...options })
	);

	viewport.size.width = 800;
	viewport.size.height = 600;

	return { viewport, wrapper };
}

describe('useMapViewport', () => {
	describe('options and defaults', () => {
		it('defaults center, scale, bounds, and input knobs', () => {
			const { viewport } = makeViewport();

			expect(viewport.center).toEqual({ x: 0.5, y: 0.5 });
			expect(viewport.scale).toBe(1);
			expect(viewport.minScale).toBe(0.5);
			expect(viewport.maxScale).toBe(40);
			expect(viewport.wheelSensitivity).toBe(0.5);
			expect(viewport.momentum).toBe(1);
		});

		it('clamps the initial center and scale', () => {
			const { viewport } = makeViewport({
				center: { x: 2, y: -1 },
				scale: 100,
			});

			expect(viewport.center).toEqual({ x: 1, y: 0 });
			expect(viewport.scale).toBe(40);
		});

		it('respects custom scale bounds', () => {
			const { viewport } = makeViewport({
				minScale: 2,
				maxScale: 10,
				scale: 1,
			});

			expect(viewport.scale).toBe(2);
			expect(viewport.minScale).toBe(2);
			expect(viewport.maxScale).toBe(10);
		});
	});

	describe('world size derivation', () => {
		it('uses the largest layer sprite viewBox when no worldSize is given', () => {
			const { result: viewport } = withSetup(() =>
				useMapViewport({
					layers: [
						makeLayer({
							name: 'small',
							sprite: svgSprite(100, 100),
						}),
						makeLayer({
							name: 'big',
							sprite: svgSprite(2000, 1000),
						}),
					],
				})
			);
			viewport.size.width = 200;
			viewport.size.height = 100;

			// base = max(200/2000, 100/1000) = 0.1
			const transform = viewport.getTransform();
			expect(transform.width).toBe(200);
			expect(transform.height).toBe(100);
		});

		it('falls back to width/height attributes without a viewBox', () => {
			const sprite =
				'<svg xmlns="http://www.w3.org/2000/svg" width="500" height="250"><rect/></svg>';
			const { result: viewport } = withSetup(() =>
				useMapViewport({ layers: [makeLayer({ name: 'wh', sprite })] })
			);
			viewport.size.width = 500;
			viewport.size.height = 250;

			const transform = viewport.getTransform();
			expect(transform.width).toBe(500);
			expect(transform.height).toBe(250);
		});
	});

	describe('coordinate conversion', () => {
		it('maps the world center point to the screen center', () => {
			const { viewport } = makeViewport();

			expect(viewport.worldToScreen({ x: 500, y: 500 })).toEqual({
				x: 400,
				y: 300,
			});
		});

		it('scales world offsets by the effective pixel scale', () => {
			const { viewport } = makeViewport();

			// 100 world px * 0.8 base scale = 80 screen px
			expect(viewport.worldToScreen({ x: 600, y: 500 })).toEqual({
				x: 480,
				y: 300,
			});
		});

		it('round-trips through screenToWorld', () => {
			const { viewport } = makeViewport({
				scale: 3,
				center: { x: 0.3, y: 0.7 },
			});

			const world = viewport.screenToWorld({ x: 123, y: 456 });
			const screen = viewport.worldToScreen(world);

			expect(screen.x).toBeCloseTo(123);
			expect(screen.y).toBeCloseTo(456);
		});

		it('exposes the CSS transform for the current view', () => {
			const { viewport } = makeViewport();

			expect(viewport.getTransform()).toEqual({
				// 800/2 - 0.5 * 1000 * 0.8 = 0
				x: 0,
				// 600/2 - 0.5 * 1000 * 0.8 = -100
				y: -100,
				scale: 1,
				width: 800,
				height: 800,
			});
		});
	});

	describe('pan', () => {
		it('moves the center opposite to the screen-space delta', () => {
			const { viewport } = makeViewport();

			viewport.pan({ x: -80, y: 0 }, { duration: 0 });
			frame();

			// 80 screen px / (0.8 * 1000 world px) = 0.1
			expect(viewport.center.x).toBeCloseTo(0.6);
			expect(viewport.center.y).toBeCloseTo(0.5);
		});

		it('clamps the target center to the world', () => {
			const { viewport } = makeViewport();

			viewport.pan({ x: -10000, y: 10000 }, { duration: 0 });
			frame();

			expect(viewport.center).toEqual({ x: 1, y: 0 });
		});

		it('continues from the animation target, not the rendered state', () => {
			const { viewport } = makeViewport();

			viewport.pan({ x: -80, y: 0 }, { duration: 100 });
			viewport.pan({ x: -80, y: 0 }, { duration: 0 });
			frame();

			expect(viewport.center.x).toBeCloseTo(0.7);
		});
	});

	describe('zoomTo', () => {
		it('centers the given world point at the target scale', () => {
			const { viewport } = makeViewport();

			viewport.zoomTo({ x: 250, y: 250 }, 2, { duration: 0 });
			frame();

			expect(viewport.scale).toBe(2);
			expect(viewport.center.x).toBeCloseTo(0.25);
			expect(viewport.center.y).toBeCloseTo(0.25);
		});

		it('places the point at a custom screen origin', () => {
			const { viewport } = makeViewport();

			viewport.zoomTo({ x: 250, y: 250 }, 2, {
				origin: { x: 0.75, y: 0.5 },
				duration: 0,
			});
			frame();

			// screenX = (0.75 - 0.5) * 800 = 200; center.x = (250 - 200/1.6)/1000
			expect(viewport.center.x).toBeCloseTo(0.125);
			expect(viewport.center.y).toBeCloseTo(0.25);

			const screen = viewport.worldToScreen({ x: 250, y: 250 });
			expect(screen.x).toBeCloseTo(0.75 * 800);
			expect(screen.y).toBeCloseTo(0.5 * 600);
		});

		it('clamps the target scale to the bounds', () => {
			const { viewport } = makeViewport({ maxScale: 10 });

			viewport.zoomTo({ x: 500, y: 500 }, 100, { duration: 0 });
			frame();

			expect(viewport.scale).toBe(10);
		});
	});

	describe('zoomBy', () => {
		it('multiplies the scale around the screen center by default', () => {
			const { viewport } = makeViewport();

			viewport.zoomBy(2, undefined, { duration: 0 });
			frame();

			expect(viewport.scale).toBe(2);
			expect(viewport.center).toEqual({ x: 0.5, y: 0.5 });
		});

		it('keeps the world point under the given screen origin fixed', () => {
			const { viewport } = makeViewport();
			const origin = { x: 700, y: 100 };
			const anchor = viewport.screenToWorld(origin);

			viewport.zoomBy(2.5, origin, { duration: 0 });
			frame();

			const after = viewport.worldToScreen(anchor);
			expect(after.x).toBeCloseTo(origin.x);
			expect(after.y).toBeCloseTo(origin.y);
		});

		it('compounds onto a pending animation target', () => {
			const { viewport } = makeViewport();

			viewport.zoomBy(2, undefined, { duration: 100 });
			viewport.zoomBy(2, undefined, { duration: 0 });
			frame();

			expect(viewport.scale).toBe(4);
		});
	});

	describe('fitToPoints', () => {
		it('frames the bounds of the given points with padding', () => {
			const { viewport } = makeViewport({ minScale: 0.5 });

			viewport.fitToPoints(
				[
					{ x: 100, y: 100 },
					{ x: 900, y: 900 },
				],
				{ padding: 100, duration: 0 }
			);
			frame();

			// available 600x400; scale = min(600/(800*0.8), 400/(800*0.8))
			expect(viewport.scale).toBeCloseTo(0.625);
			expect(viewport.center).toEqual({ x: 0.5, y: 0.5 });
		});

		it('never zooms out past minScale to make bounds fit', () => {
			const { viewport } = makeViewport();

			// A near-world-spanning bbox with heavy padding wants to zoom well
			// below minScale; animateTo clamps the fit to minScale (0.5)
			viewport.fitToPoints(
				[
					{ x: 0, y: 0 },
					{ x: 1000, y: 1000 },
				],
				{ padding: 400, duration: 0 }
			);
			frame();

			expect(viewport.scale).toBe(0.5);
		});

		it('caps a tight cluster at the per-call maxScale', () => {
			const { viewport } = makeViewport();

			viewport.fitToPoints(
				[
					{ x: 500, y: 500 },
					{ x: 500, y: 500 },
				],
				{ maxScale: 5, duration: 0 }
			);
			frame();

			expect(viewport.scale).toBe(5);
		});

		it('shifts the frame center into the visible strip with per-side padding', () => {
			const { viewport } = makeViewport();

			viewport.fitToPoints(
				[
					{ x: 400, y: 400 },
					{ x: 600, y: 600 },
				],
				{ padding: { left: 400 }, maxScale: 2, duration: 0 }
			);
			frame();

			// The fitted bounds' midpoint should land at the center of the
			// unoccluded strip (x in [400, 800] on screen), not the viewport.
			const screen = viewport.worldToScreen({ x: 500, y: 500 });
			expect(screen.x).toBeCloseTo(600);
			expect(screen.y).toBeCloseTo(300);
		});

		it('ignores empty point lists', () => {
			const { viewport } = makeViewport();

			viewport.fitToPoints([], { duration: 0 });
			frame();

			expect(viewport.scale).toBe(1);
			expect(viewport.center).toEqual({ x: 0.5, y: 0.5 });
		});

		it('ignores calls while the viewport has no size', () => {
			const { viewport } = makeViewport();
			viewport.size.width = 0;
			viewport.size.height = 0;

			viewport.fitToPoints([{ x: 100, y: 100 }], { duration: 0 });
			frame();

			expect(viewport.center).toEqual({ x: 0.5, y: 0.5 });
		});
	});

	describe('animation', () => {
		it('interpolates the center along the easing', () => {
			const { viewport } = makeViewport();

			viewport.pan({ x: -160, y: 0 }, { duration: 100, easing: linear });
			frame(50);

			expect(viewport.center.x).toBeCloseTo(0.6);

			frame(50);
			expect(viewport.center.x).toBeCloseTo(0.7);
		});

		it('interpolates scale multiplicatively (constant zoom velocity per octave)', () => {
			const { viewport } = makeViewport();

			viewport.zoomTo({ x: 500, y: 500 }, 4, {
				duration: 100,
				easing: linear,
			});
			frame(50);

			// 1 * (4/1)^0.5 = 2, not the additive midpoint 2.5
			expect(viewport.scale).toBeCloseTo(2);
		});

		it('eases the focused point along a straight screen-space path', () => {
			const { viewport } = makeViewport();
			const point = { x: 250, y: 250 };
			const from = viewport.worldToScreen(point);

			viewport.zoomTo(point, 4, { duration: 100, easing: linear });
			frame(50);

			const halfway = viewport.worldToScreen(point);
			expect(halfway.x).toBeCloseTo((from.x + 400) / 2);
			expect(halfway.y).toBeCloseTo((from.y + 300) / 2);

			frame(50);
			const done = viewport.worldToScreen(point);
			expect(done.x).toBeCloseTo(400);
			expect(done.y).toBeCloseTo(300);
		});

		it('finishes exactly on the target and deactivates', () => {
			const { viewport } = makeViewport();

			viewport.pan({ x: -80, y: -60 }, { duration: 100 });
			frame(100);
			const settled = { ...viewport.center };

			frame(100);
			expect(viewport.center).toEqual(settled);
		});

		it('uses the constructor duration and easing as defaults', () => {
			const { viewport } = makeViewport({
				duration: 100,
				easing: linear,
			});

			viewport.pan({ x: -160, y: 0 });
			frame(50);

			expect(viewport.center.x).toBeCloseTo(0.6);
		});

		it('stop() freezes the viewport mid-animation', () => {
			const { viewport } = makeViewport();

			viewport.pan({ x: -160, y: 0 }, { duration: 100, easing: linear });
			frame(50);
			viewport.stop();
			frame(50);
			frame(50);

			expect(viewport.center.x).toBeCloseTo(0.6);
		});
	});

	describe('setElement', () => {
		it('reads the element size and tracks resizes', () => {
			const { viewport } = makeViewport();

			const element = document.createElement('div');
			Object.defineProperty(element, 'clientWidth', { value: 400 });
			Object.defineProperty(element, 'clientHeight', { value: 300 });

			viewport.setElement(element);
			expect(viewport.size).toEqual({ width: 400, height: 300 });

			triggerResize(element, { width: 1024, height: 768 });
			expect(viewport.size).toEqual({ width: 1024, height: 768 });
		});

		it('stops tracking after setElement(null)', () => {
			const { viewport } = makeViewport();

			const element = document.createElement('div');
			Object.defineProperty(element, 'clientWidth', { value: 400 });
			Object.defineProperty(element, 'clientHeight', { value: 300 });

			viewport.setElement(element);
			viewport.setElement(null);
			triggerResize(element, { width: 1024, height: 768 });

			expect(viewport.size).toEqual({ width: 400, height: 300 });
		});
	});
});
