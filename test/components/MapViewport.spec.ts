import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import MapViewport from '../../src/runtime/components/MapViewport.vue';
import useMapGestures from '../../src/runtime/composables/useMapGestures';
import type { IEngine } from '../../src/runtime/types';
import { triggerResize } from '../mocks';
import { makeEngine } from '../utils';

// Gesture behavior lives in test/unit/useMapGestures.spec.ts — what belongs
// here is only that this element is wired to the recognizer and renders the
// viewport transform.
function mountViewport(engine: IEngine) {
	const gestures = useMapGestures(engine.viewport);
	const wrapper = mount(MapViewport, { props: { engine, gestures } });

	return { wrapper, gestures, root: wrapper.element };
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

	it('registers its element with the recognizer on mount and clears it on unmount', () => {
		const { engine } = makeEngine();
		const gestures = useMapGestures(engine.viewport);
		const setElement = vi.spyOn(gestures, 'setElement');

		const wrapper = mount(MapViewport, { props: { engine, gestures } });
		expect(setElement).toHaveBeenCalledWith(wrapper.element);

		wrapper.unmount();
		expect(setElement).toHaveBeenLastCalledWith(null);
	});

	it('binds the recognizer to its element', async () => {
		const { engine } = makeEngine();
		const gestures = useMapGestures(engine.viewport);
		// Spied before mount: v-on captures the handler references at render
		const pointerdown = vi.spyOn(gestures.handlers, 'pointerdown');
		const wrapper = mount(MapViewport, { props: { engine, gestures } });

		await wrapper.trigger('pointerdown');

		expect(pointerdown).toHaveBeenCalled();
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
});
