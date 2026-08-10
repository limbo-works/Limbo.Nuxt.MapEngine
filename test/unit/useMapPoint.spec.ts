import { describe, expect, it } from 'vitest';
import { isReactive } from 'vue';
import useMapPoint from '../../src/runtime/composables/useMapPoint';

describe('useMapPoint', () => {
	it('defaults the optional fields', () => {
		const point = useMapPoint({ id: 'a', label: 'A' });

		expect(isReactive(point)).toBe(true);
		expect(point.tags).toEqual([]);
		expect(point.groups).toEqual([]);
		expect(point.buildings).toEqual([]);
		expect(point.content).toBeUndefined();
		expect(point.clickable).toBe(true);
		expect(point.anchor).toBeUndefined();
		expect(point.visible).toBe(true);
		expect(point.position).toEqual({ x: 0, y: 0 });
	});

	it('starts with all runtime-managed state off', () => {
		const point = useMapPoint({ id: 'a', label: 'A' });

		expect(point.selectedAsDestination).toBe(false);
		expect(point.selectedAsOrigin).toBe(false);
	});

	it('maps x/y options into position', () => {
		const point = useMapPoint({ id: 'a', label: 'A', x: 120, y: 340 });

		expect(point.position).toEqual({ x: 120, y: 340 });
	});

	it('passes the content payload through opaquely', () => {
		const content = { icon: '<svg></svg>' };
		const point = useMapPoint({ id: 'a', label: 'A', content });

		// reactive() proxies nested objects, so this is a deep-equal payload
		// rather than the exact same reference
		expect(point.content).toEqual(content);
	});

	it('defaults clickable to true and respects an explicit false', () => {
		expect(useMapPoint({ id: 'a', label: 'A' }).clickable).toBe(true);
		expect(
			useMapPoint({ id: 'a', label: 'A', clickable: false }).clickable
		).toBe(false);
	});

	it('passes an authored anchor through, defaulting to undefined', () => {
		const point = useMapPoint({
			id: 'a',
			label: 'A',
			anchor: { x: 0.5, y: 0.5 },
		});

		expect(point.anchor).toEqual({ x: 0.5, y: 0.5 });
		expect(useMapPoint({ id: 'b', label: 'B' }).anchor).toBeUndefined();
	});

	it('passes an authored layer through, defaulting to undefined', () => {
		expect(
			useMapPoint({ id: 'a', label: 'A', layer: 'floor-1' }).layer
		).toBe('floor-1');
		expect(useMapPoint({ id: 'b', label: 'B' }).layer).toBeUndefined();
	});
});
