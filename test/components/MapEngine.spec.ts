import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import MapEngine from '../../src/runtime/components/MapEngine.vue';
import { makeEngine } from '../utils';

// Only the two bind-site tests below need real events — test-utils' trigger()
// can't set clientX/pointerId (getter-only on MouseEvent), and constructing
// them is enough here since neither test depends on event timing.
function firePointer(
	target: Element,
	type: string,
	options: { pointerId?: number; clientX?: number; clientY?: number } = {}
): void {
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerId: options.pointerId ?? 1,
			clientX: options.clientX ?? 0,
			clientY: options.clientY ?? 0,
		})
	);
}

describe('MapEngine', () => {
	it('renders every visible layer', () => {
		const { engine } = makeEngine();
		const wrapper = mount(MapEngine, { props: { engine } });

		// base + walking-routes; toggleables, highlights, and layers gated to
		// an unselected floor stay out of the DOM (sprites render in shadow
		// roots on the transition wrappers — count the wrappers)
		const layers = wrapper.findAll('.c-map-layer-transition');
		expect(layers).toHaveLength(2);
	});

	it('adds layers to the DOM when their floor becomes selected', async () => {
		const { engine } = makeEngine();
		const wrapper = mount(MapEngine, { props: { engine } });

		engine.selectFloor(engine.floors[0]);
		await nextTick();

		expect(wrapper.findAll('.c-map-layer-transition')).toHaveLength(3);
	});

	it('renders every point through the point slot', () => {
		const { engine } = makeEngine();
		const wrapper = mount(MapEngine, {
			props: { engine },
			slots: {
				point: `<template #point="{ point }">
					<span class="test-pin">{{ point.label }}</span>
				</template>`,
			},
		});

		const pins = wrapper.findAll('.test-pin');
		expect(pins.map((pin) => pin.text())).toEqual([
			'Bæredygtigt byggeri',
			'Eventdeltager',
			'Kaffebar',
			'Toilet',
		]);
	});

	it('renders consumer UI into the overlay layer', () => {
		const { engine } = makeEngine();
		const wrapper = mount(MapEngine, {
			props: { engine },
			slots: {
				overlay: '<span class="test-overlay">UI</span>',
			},
		});

		expect(
			wrapper.find('.c-map-engine__overlay .test-overlay').exists()
		).toBe(true);
	});

	// The points layer is a sibling overlay above the viewport (not a
	// descendant), so gestures starting on a pin never reach the viewport's
	// own bindings — binding the recognizer here too is what makes dragging,
	// pinching, and scroll-to-zoom work over a POI. What the recognizer then
	// does with the input is covered in test/unit/useMapGestures.spec.ts.
	it('drives the recognizer from the points layer', () => {
		const { engine } = makeEngine();
		const zoomBy = vi.spyOn(engine.viewport, 'zoomBy');
		const wrapper = mount(MapEngine, { props: { engine } });

		wrapper
			.find('.c-map-engine__points')
			.element.dispatchEvent(
				new WheelEvent('wheel', { deltaY: -100, cancelable: true })
			);

		expect(zoomBy).toHaveBeenCalledTimes(1);
	});

	// One recognizer instance across both bind sites: a two-finger pinch can
	// land one finger on a pin and the other on bare map, and only a shared
	// instance tracks those as a single gesture.
	it('shares one recognizer across both bind sites', () => {
		const { engine } = makeEngine();
		const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
		const wrapper = mount(MapEngine, { props: { engine } });

		// One finger down on a pin, the other on bare map, then a spread
		firePointer(
			wrapper.find('.c-map-engine__points').element,
			'pointerdown',
			{
				pointerId: 1,
				clientX: 100,
			}
		);
		firePointer(wrapper.find('.c-map-viewport').element, 'pointerdown', {
			pointerId: 2,
			clientX: 200,
		});
		firePointer(wrapper.find('.c-map-viewport').element, 'pointermove', {
			pointerId: 2,
			clientX: 250,
		});

		expect(zoomTo).toHaveBeenCalledTimes(1);
		expect(zoomTo.mock.calls[0][1]).toBeCloseTo(1.5);
	});
});
