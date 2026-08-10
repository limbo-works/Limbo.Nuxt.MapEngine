import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import MapLayer from '../../src/runtime/components/MapLayer.vue';
import type { IEngine, ILayer } from '../../src/runtime/types';
import { frame } from '../mocks';
import { makeEngine, makeLayer } from '../utils';

function mountLayer(engine: IEngine, layer: ILayer) {
	return mount(MapLayer, { props: { layer, engine } });
}

// The sprite renders inside a shadow root on the transition wrapper (see
// MapLayer.vue) — pierce it, since test-utils' find only sees light DOM.
function findSprite(wrapper: ReturnType<typeof mountLayer>): SVGElement | null {
	const host = wrapper.find('.c-map-layer-transition');
	if (!host.exists()) {
		return null;
	}

	return (
		(host.element as HTMLElement).shadowRoot?.querySelector(
			'svg.c-map-layer'
		) ?? null
	);
}

describe('MapLayer', () => {
	it('renders a visible layer with the sprite root attributes', () => {
		const { engine } = makeEngine();
		const wrapper = mountLayer(engine, makeLayer({ name: 'base' }));

		const svg = findSprite(wrapper);
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('viewBox')).toBe('0 0 1000 1000');
		expect(
			wrapper
				.find('.c-map-layer-transition')
				.attributes('data-layer-name')
		).toBe('base');
	});

	it('keeps hidden layers out of the DOM', () => {
		const { engine } = makeEngine();
		const layer = makeLayer({ name: 'toggle', label: 'Toggle' });

		const wrapper = mountLayer(engine, layer);

		expect(findSprite(wrapper)).toBeNull();
	});

	it('shows a hidden layer while forceVisible is set', async () => {
		const { engine } = makeEngine();
		const layer = makeLayer({ name: 'routes', kind: 'walking-routes' });
		layer.visible = false;
		const wrapper = mountLayer(engine, layer);
		expect(findSprite(wrapper)).toBeNull();

		layer.forceVisible = true;
		await nextTick();

		expect(findSprite(wrapper)).not.toBeNull();
	});

	it('gates floor layers on the selected floor', async () => {
		const { engine } = makeEngine();
		const layer = makeLayer({ name: 'floor-1', floor: '1' });
		const wrapper = mountLayer(engine, layer);

		expect(findSprite(wrapper)).toBeNull();

		engine.selectFloor(engine.floors[1]);
		await nextTick();
		expect(findSprite(wrapper)).not.toBeNull();

		engine.selectFloor(engine.floors[0]);
		await nextTick();
		// The leave tween has to finish before the element is removed
		frame(300);
		await nextTick();
		expect(findSprite(wrapper)).toBeNull();
	});

	it('tweens opacity over the CSS-configured duration on enter', async () => {
		const { engine } = makeEngine();
		const layer = makeLayer({ name: 'toggle', label: 'Toggle' });
		const wrapper = mountLayer(engine, layer);

		layer.visible = true;
		await nextTick();

		const element = wrapper.find('.c-map-layer-transition')
			.element as HTMLElement;
		frame(0);
		expect(Number(element.style.opacity)).toBeLessThan(1);

		frame(300);
		expect(element.style.opacity).toBe('1');
	});

	describe('scale feathering', () => {
		async function opacityAt(scale: number, options = {}) {
			const { engine } = makeEngine();
			const layer = makeLayer({
				name: 'feathered',
				minScale: 5,
				maxScale: 10,
				scaleFeather: 1,
				...options,
			});
			const wrapper = mountLayer(engine, layer);

			engine.viewport.scale = scale;
			await nextTick();

			const svg = findSprite(wrapper)!;
			return Number(svg.style.opacity);
		}

		it('hides the sprite below the feathered minScale', async () => {
			expect(await opacityAt(3)).toBe(0);
		});

		it('ramps through the feather band around minScale', async () => {
			expect(await opacityAt(4.5)).toBeCloseTo(0.25);
			expect(await opacityAt(5)).toBeCloseTo(0.5);
			expect(await opacityAt(5.5)).toBeCloseTo(0.75);
		});

		it('is fully visible between the bands', async () => {
			expect(await opacityAt(7)).toBe(1);
		});

		it('ramps back down around maxScale', async () => {
			expect(await opacityAt(10)).toBeCloseTo(0.5);
		});

		it('hides the sprite above the feathered maxScale', async () => {
			expect(await opacityAt(12)).toBe(0);
		});
	});

	describe('sprite variable wiring', () => {
		const sprite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
			<path id="a" stroke-width="3" d="M0 0"/>
			<g id="scale_marker" data-scale-origin="50% 100%" data-scale-factor="0.2"><rect/></g>
		</svg>`;

		it('captures authored stroke widths into a custom property', async () => {
			const { engine } = makeEngine();
			const wrapper = mountLayer(
				engine,
				makeLayer({ name: 's', sprite })
			);
			await nextTick();

			const path = findSprite(wrapper)!.querySelector(
				'[stroke-width]'
			) as HTMLElement;
			expect(path.style.getPropertyValue('--default-stroke-width')).toBe(
				'3'
			);
		});

		it('applies per-element scale-origin and scale-factor overrides', async () => {
			const { engine } = makeEngine();
			const wrapper = mountLayer(
				engine,
				makeLayer({ name: 's', sprite })
			);
			await nextTick();

			const marker = findSprite(wrapper)!.querySelector(
				'[data-scale-origin]'
			) as HTMLElement;
			expect(marker.style.transformOrigin).toBe('50% 100%');
			expect(marker.style.getPropertyValue('--scale-factor')).toBe('0.2');
		});

		it('rewires the variables when the layer remounts after a toggle', async () => {
			const { engine } = makeEngine();
			const layer = makeLayer({ name: 's', sprite, label: 'S' });
			const wrapper = mountLayer(engine, layer);

			layer.visible = true;
			await nextTick();
			frame(300);

			const path = findSprite(wrapper)!.querySelector(
				'[stroke-width]'
			) as HTMLElement;
			expect(path.style.getPropertyValue('--default-stroke-width')).toBe(
				'3'
			);
		});
	});
});
