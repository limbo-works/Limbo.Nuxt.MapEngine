import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import MapEngine from '../../src/runtime/components/MapEngine.vue';
import { makeEngine } from '../utils';

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
	// descendant), so a wheel event over a pin wouldn't otherwise reach the
	// viewport's own listener — regression test for that forwarding.
	it('forwards wheel events from the points layer into the viewport', () => {
		const { engine } = makeEngine();
		const zoomBy = vi.spyOn(engine.viewport, 'zoomBy');
		const wrapper = mount(MapEngine, { props: { engine } });

		wrapper.find('.c-map-engine__points').element.dispatchEvent(
			new WheelEvent('wheel', {
				deltaY: -100,
				deltaMode: 0,
				clientX: 100,
				clientY: 50,
				cancelable: true,
			})
		);

		expect(zoomBy).toHaveBeenCalledTimes(1);
	});
});
