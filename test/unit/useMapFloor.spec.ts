import { describe, expect, it } from 'vitest';
import { isReactive } from 'vue';
import useMapFloor from '../../src/runtime/composables/useMapFloor';

describe('useMapFloor', () => {
	it('returns a reactive floor with the authored fields', () => {
		const floor = useMapFloor({ id: '0', label: 'st' });

		expect(isReactive(floor)).toBe(true);
		expect(floor).toEqual({ id: '0', label: 'st' });
	});
});
