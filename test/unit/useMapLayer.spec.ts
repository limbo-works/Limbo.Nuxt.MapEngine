import { describe, expect, it } from 'vitest';
import { isReactive } from 'vue';
import useMapLayer from '../../src/runtime/composables/useMapLayer';
import { svgSprite } from '../utils';

function makeLayer(options: Record<string, unknown> = {}) {
	return useMapLayer({
		name: 'layer',
		sprite: svgSprite(1000, 1000),
		...options,
	});
}

describe('useMapLayer', () => {
	it('returns a reactive layer with defaults', () => {
		const layer = makeLayer();

		expect(isReactive(layer)).toBe(true);
		expect(layer.name).toBe('layer');
		expect(layer.forceVisible).toBe(false);
	});

	it('shows unlabeled plain layers by default', () => {
		expect(makeLayer().visible).toBe(true);
	});

	it('hides labeled (toggleable) layers by default', () => {
		expect(makeLayer({ label: 'Parkering' }).visible).toBe(false);
	});

	it('respects enabled as the initial toggle state for labeled layers', () => {
		expect(makeLayer({ label: 'Parkering', enabled: true }).visible).toBe(
			true
		);
		expect(makeLayer({ label: 'Parkering', enabled: false }).visible).toBe(
			false
		);
	});

	it('hides building-highlight layers by default even without a label', () => {
		expect(makeLayer({ kind: 'building-highlight' }).visible).toBe(false);
	});

	it('keeps unlabeled walking-routes layers visible', () => {
		expect(makeLayer({ kind: 'walking-routes' }).visible).toBe(true);
	});

	it('passes metadata through', () => {
		const layer = makeLayer({
			label: 'Gåruter',
			color: '#38C262',
			kind: 'walking-routes',
			floor: '1',
		});

		expect(layer.label).toBe('Gåruter');
		expect(layer.color).toBe('#38C262');
		expect(layer.kind).toBe('walking-routes');
		expect(layer.floor).toBe('1');
	});

	it('forwards scale options to the sprite', () => {
		const layer = makeLayer({
			minScale: 5,
			maxScale: 12,
			scaleFeather: 2,
			scaleFactor: 0.3,
			scaleOrigin: '50% 100%',
		});

		expect(layer.sprite.minScale).toBe(5);
		expect(layer.sprite.maxScale).toBe(12);
		expect(layer.sprite.scaleFeather).toBe(2);
		expect(layer.sprite.scaleFactor).toBe(0.3);
		expect(layer.sprite.scaleOrigin).toBe('50% 100%');
	});
});
