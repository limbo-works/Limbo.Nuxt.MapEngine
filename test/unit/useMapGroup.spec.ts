import { describe, expect, it } from 'vitest';
import { isReactive } from 'vue';
import useMapGroup from '../../src/runtime/composables/useMapGroup';

describe('useMapGroup', () => {
	it('returns a reactive group with the authored fields', () => {
		const group = useMapGroup({
			id: 'byggeri',
			label: 'Byggeri',
			color: '#c0935f',
		});

		expect(isReactive(group)).toBe(true);
		expect(group).toEqual({
			id: 'byggeri',
			label: 'Byggeri',
			color: '#c0935f',
		});
	});

	it('passes an authored textColor through, defaulting to undefined', () => {
		expect(
			useMapGroup({
				id: 'a',
				label: 'A',
				color: '#000',
				textColor: '#fff',
			}).textColor
		).toBe('#fff');
		expect(
			useMapGroup({ id: 'b', label: 'B', color: '#000' }).textColor
		).toBeUndefined();
	});
});
