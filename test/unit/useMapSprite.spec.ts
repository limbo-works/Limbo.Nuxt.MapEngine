import { describe, expect, it } from 'vitest';
import useMapSprite from '../../src/runtime/composables/useMapSprite';

const svg =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50"><rect width="100" height="50"/><circle r="5"/></svg>';

describe('useMapSprite', () => {
	it('keeps the raw data', () => {
		expect(useMapSprite({ data: svg }).data).toBe(svg);
	});

	it('parses the root tag attributes', () => {
		const sprite = useMapSprite({ data: svg });

		expect(sprite.attributes.viewBox).toBe('0 0 100 50');
		expect(sprite.attributes.width).toBe('100');
		expect(sprite.attributes.height).toBe('50');
		expect(sprite.attributes.xmlns).toBe('http://www.w3.org/2000/svg');
	});

	it('captures the markup used for rendering, inner content included', () => {
		const sprite = useMapSprite({ data: svg });

		expect(sprite.children).toContain('<rect width="100" height="50"/>');
		expect(sprite.children).toContain('<circle r="5"/>');
	});

	it('handles markup without a matching svg root', () => {
		const sprite = useMapSprite({ data: '<div>not svg</div>' });

		expect(sprite.attributes).toEqual({});
		expect(sprite.children).toBe('');
	});

	it('defaults the scale behavior options', () => {
		const sprite = useMapSprite({ data: svg });

		expect(sprite.minScale).toBeUndefined();
		expect(sprite.maxScale).toBeUndefined();
		expect(sprite.scaleFeather).toBe(1);
		expect(sprite.scaleFactor).toBe(1);
		expect(sprite.scaleOrigin).toBe('center');
		expect(sprite.counterScaleFrom).toBeUndefined();
	});

	it('passes the scale behavior options through', () => {
		const sprite = useMapSprite({
			data: svg,
			minScale: 2,
			maxScale: 8,
			scaleFeather: 0.5,
			scaleFactor: 0.1,
			scaleOrigin: '50% 100%',
			counterScaleFrom: 4,
		});

		expect(sprite.minScale).toBe(2);
		expect(sprite.maxScale).toBe(8);
		expect(sprite.scaleFeather).toBe(0.5);
		expect(sprite.scaleFactor).toBe(0.1);
		expect(sprite.scaleOrigin).toBe('50% 100%');
		expect(sprite.counterScaleFrom).toBe(4);
	});
});
