import { defineComponent, h } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';

import useMapEngine from '../src/runtime/composables/useMapEngine';
import useMapFloor from '../src/runtime/composables/useMapFloor';
import useMapGroup from '../src/runtime/composables/useMapGroup';
import useMapLayer from '../src/runtime/composables/useMapLayer';
import useMapPoint from '../src/runtime/composables/useMapPoint';

import type {
	IEngine,
	IEngineOptions,
	ILayerOptions,
	IPointOptions,
} from '../src/runtime/types';
import type { IMapPointContent } from '../playground/types';

/**
 * Runs a composable inside a real component instance so its lifecycle hooks
 * (onMounted, onBeforeUnmount — used by onUpdate, useMapUrlSync, and the
 * viewport's RAF loop) actually fire.
 */
export function withSetup<T>(setup: () => T): {
	result: T;
	wrapper: VueWrapper;
} {
	let result: T;

	const wrapper = mount(
		defineComponent({
			setup() {
				result = setup();
				return () => h('div');
			},
		})
	);

	return { result: result!, wrapper };
}

/**
 * Dispatches a pointer event with a controlled timeStamp — the gesture
 * velocity tracking reads event.timeStamp, which is read-only on the
 * constructed event and has to be overridden per instance.
 */
export function firePointer(
	target: Element,
	type: string,
	options: {
		pointerId?: number;
		clientX?: number;
		clientY?: number;
		timeStamp?: number;
	} = {}
): void {
	const event = new PointerEvent(type, {
		bubbles: true,
		cancelable: true,
		pointerId: options.pointerId ?? 1,
		clientX: options.clientX ?? 0,
		clientY: options.clientY ?? 0,
	});

	if (options.timeStamp !== undefined) {
		Object.defineProperty(event, 'timeStamp', {
			value: options.timeStamp,
		});
	}

	target.dispatchEvent(event);
}

export function fireGesture(
	target: Element,
	type: string,
	options: { scale?: number; clientX?: number; clientY?: number } = {}
): void {
	const event = new Event(type, { bubbles: true, cancelable: true });

	Object.assign(event, {
		scale: options.scale ?? 1,
		clientX: options.clientX ?? 0,
		clientY: options.clientY ?? 0,
	});

	target.dispatchEvent(event);
}

export function svgSprite(width: number, height: number): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}"/></svg>`;
}

export function makeLayer(options: Partial<ILayerOptions> = {}) {
	return useMapLayer({
		name: options.name ?? 'base',
		sprite: options.sprite ?? svgSprite(1000, 1000),
		...options,
	});
}

export function makePoint(options: Partial<IPointOptions> = {}) {
	return useMapPoint({
		id: options.id ?? 'point',
		label: options.label ?? 'Point',
		...options,
	});
}

/**
 * A mounted engine over a 1000x1000 world with an 800x600 viewport —
 * cover-fit base scale is exactly 0.8, keeping expected values readable.
 * Content mirrors the playground's shape: a walking-routes layer,
 * building-highlight layers, floor layers, one toggleable layer, and the
 * four point archetypes from SoW §3.3.
 */
export function makeEngine(options: IEngineOptions = {}): {
	engine: IEngine;
	wrapper: VueWrapper;
} {
	const { result: engine, wrapper } = withSetup(() => useMapEngine(options));

	engine.layers.push(
		makeLayer({ name: 'base' }),
		makeLayer({ name: 'routes', kind: 'walking-routes' }),
		makeLayer({ name: '6', kind: 'building-highlight' }),
		makeLayer({ name: '40', kind: 'building-highlight' }),
		makeLayer({ name: 'floor-0', floor: '0', minScale: 5 }),
		makeLayer({ name: 'floor-1', floor: '1', minScale: 5 }),
		makeLayer({ name: 'parking', label: 'Parkering', color: '#08AFE6' })
	);

	engine.floors.push(
		useMapFloor({ id: '0', label: 'st' }),
		useMapFloor({ id: '1', label: '1' })
	);

	engine.groups.push(
		useMapGroup({ id: 'byggeri', label: 'Byggeri', color: '#c0935f' }),
		useMapGroup({ id: 'landbrug', label: 'Landbrug', color: '#8faf5f' })
	);

	engine.points.push(
		makePoint({
			id: 'title-point',
			label: 'Bæredygtigt byggeri',
			tags: ['Tømrer', 'Træ'],
			groups: ['byggeri'],
			buildings: ['6'],
			x: 200,
			y: 200,
			content: {
				blocks: [{ alias: 'richText', text: 'Indhold' }],
			} satisfies IMapPointContent,
		}),
		makePoint({
			id: 'link-point',
			label: 'Eventdeltager',
			tags: ['Gæst'],
			groups: ['byggeri'],
			buildings: ['6'],
			x: 800,
			y: 200,
			content: {
				link: { url: 'https://example.com', target: '_blank' },
			} satisfies IMapPointContent,
		}),
		makePoint({
			id: 'icon-point',
			label: 'Kaffebar',
			tags: ['Kaffe'],
			groups: ['landbrug'],
			buildings: ['40'],
			x: 200,
			y: 800,
			content: {
				icon: svgSprite(20, 20),
				blocks: [
					{ alias: 'image' },
					{ alias: 'richText', title: 'Kaffebar', text: 'Indhold' },
				],
			} satisfies IMapPointContent,
		}),
		makePoint({
			id: 'bare-point',
			label: 'Toilet',
			tags: ['Faciliteter'],
			groups: ['landbrug'],
			clickable: false,
			anchor: { x: 0.5, y: 0.5 },
			x: 800,
			y: 800,
			content: {
				icon: svgSprite(20, 20),
			} satisfies IMapPointContent,
		})
	);

	engine.viewport.size.width = 800;
	engine.viewport.size.height = 600;

	return { engine, wrapper };
}
