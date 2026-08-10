import { describe, expect, it, vi } from 'vitest';
import { onUpdate } from '../../src/runtime/utils/update';
import { frame } from '../mocks';
import { withSetup } from '../utils';

describe('onUpdate', () => {
	it('starts the loop on mount with a zero first delta', () => {
		const callback = vi.fn();
		withSetup(() => onUpdate(callback));

		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith(0);
	});

	it('reports the elapsed milliseconds per frame', () => {
		const callback = vi.fn();
		withSetup(() => onUpdate(callback));

		frame(16);
		frame(33);

		expect(callback).toHaveBeenCalledTimes(3);
		expect(callback).toHaveBeenNthCalledWith(2, 16);
		expect(callback).toHaveBeenNthCalledWith(3, 33);
	});

	it('stops the loop on unmount', () => {
		const callback = vi.fn();
		const { wrapper } = withSetup(() => onUpdate(callback));

		frame();
		wrapper.unmount();
		frame();
		frame();

		expect(callback).toHaveBeenCalledTimes(2);
	});
});
