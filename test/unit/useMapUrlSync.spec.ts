import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import useMapEngine from '../../src/runtime/composables/useMapEngine';
import useMapUrlSync from '../../src/runtime/composables/useMapUrlSync';
import type { IEngine, IUrlSyncOptions } from '../../src/runtime/types';
import { makeEngine, withSetup } from '../utils';

function mountSync(
	options: IUrlSyncOptions = {},
	prepare?: (engine: IEngine) => void
) {
	const { engine, wrapper } = makeEngine();
	prepare?.(engine);

	let sync!: ReturnType<typeof useMapUrlSync>;
	const { wrapper: syncWrapper } = withSetup(() => {
		sync = useMapUrlSync(engine, options);
	});

	return { engine, sync, wrapper, syncWrapper };
}

function params(): URLSearchParams {
	return new URLSearchParams(window.location.search);
}

async function settle() {
	await nextTick();
	vi.advanceTimersByTime(200);
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('useMapUrlSync', () => {
	it('is a no-op outside the browser', () => {
		const { result: engine } = withSetup(() => useMapEngine());

		vi.stubGlobal('window', undefined);
		// Returns before registering any hooks, so no component context is
		// needed — exactly what makes it SSR-safe.
		const sync = useMapUrlSync(engine);
		vi.unstubAllGlobals();

		expect(() => {
			sync.pause();
			sync.resume();
		}).not.toThrow();
	});

	describe('writing state to the URL', () => {
		it('writes nothing while the engine matches its baseline', async () => {
			const replaceState = vi.spyOn(window.history, 'replaceState');
			mountSync();

			await settle();

			expect(replaceState).not.toHaveBeenCalled();
		});

		it('writes only the diverging viewport params', async () => {
			const { engine } = mountSync();

			engine.viewport.center.x = 0.25;
			await settle();

			expect(params().get('x')).toBe('0.25');
			expect(params().has('y')).toBe(false);
			expect(params().has('z')).toBe(false);
		});

		it('rounds center and scale before comparing and writing', async () => {
			const { engine } = mountSync();

			// Within rounding distance of the 0.5 baseline — no divergence
			engine.viewport.center.x = 0.500004;
			await settle();
			expect(params().has('x')).toBe(false);

			engine.viewport.scale = 3.20004;
			await settle();
			expect(params().get('z')).toBe('3.2');
		});

		it('removes params that return to baseline', async () => {
			const { engine } = mountSync();

			engine.viewport.center.x = 0.25;
			await settle();
			expect(params().has('x')).toBe(true);

			engine.viewport.center.x = 0.5;
			await settle();
			expect(params().has('x')).toBe(false);
		});

		it('writes floor changes, using an empty value for cleared', async () => {
			const { engine } = mountSync(undefined, (prepared) =>
				prepared.selectFloor(prepared.floors[0])
			);

			engine.selectFloor(engine.floors[1]);
			await settle();
			expect(params().get('floor')).toBe('1');

			engine.selectFloor(null);
			await settle();
			expect(params().get('floor')).toBe('');
		});

		it('writes the selected group id', async () => {
			const { engine } = mountSync();

			engine.selectGroup(engine.groups[0]);
			await settle();

			expect(params().get('group')).toBe('byggeri');
		});

		it('writes selection and origin point ids', async () => {
			const { engine } = mountSync();
			const title = engine.points[0];
			const icon = engine.points[2];

			engine.selectPoint(title);
			engine.selectOriginPoint(icon);
			await settle();

			expect(params().get('point')).toBe('title-point');
			expect(params().get('origin')).toBe('icon-point');
		});

		it('writes diverging toggleable-layer visibility', async () => {
			const { engine } = mountSync();
			const parking = engine.layers.find(
				(candidate) => candidate.name === 'parking'
			)!;

			engine.toggleLayer(parking);
			await settle();

			expect(params().get('layers')).toBe('parking:1');
		});

		it('prefixes every managed param', async () => {
			const { engine } = mountSync({ paramPrefix: 'map_' });

			engine.viewport.center.x = 0.25;
			engine.selectFloor({ id: '2', label: '2' });
			await settle();

			expect(params().get('map_x')).toBe('0.25');
			expect(params().get('map_floor')).toBe('2');
			expect(params().has('x')).toBe(false);
		});

		it('leaves unmanaged params alone', async () => {
			window.history.replaceState(null, '', '/?utm_source=mail');
			const { engine } = mountSync();

			engine.viewport.center.x = 0.25;
			await settle();

			expect(params().get('utm_source')).toBe('mail');
			expect(params().get('x')).toBe('0.25');
		});

		it('debounces bursts of changes into one URL write', async () => {
			const replaceState = vi.spyOn(window.history, 'replaceState');
			const { engine } = mountSync();

			engine.viewport.center.x = 0.2;
			await nextTick();
			vi.advanceTimersByTime(50);
			engine.viewport.center.x = 0.3;
			await nextTick();
			vi.advanceTimersByTime(50);
			engine.viewport.center.x = 0.4;
			await nextTick();
			vi.advanceTimersByTime(200);

			expect(replaceState).toHaveBeenCalledTimes(1);
			expect(params().get('x')).toBe('0.4');
		});

		it('pause() stops URL writes until resume()', async () => {
			const { engine, sync } = mountSync();

			sync.pause();
			engine.viewport.center.x = 0.25;
			await settle();
			expect(params().has('x')).toBe(false);

			sync.resume();
			engine.viewport.center.x = 0.3;
			await settle();
			expect(params().get('x')).toBe('0.3');
		});

		it('respects the sync flags', async () => {
			const { engine } = mountSync({
				syncViewport: false,
				syncFloor: false,
			});

			engine.viewport.center.x = 0.25;
			engine.selectFloor({ id: '3', label: '3' });
			engine.selectGroup(engine.groups[0]);
			await settle();

			expect(params().has('x')).toBe(false);
			expect(params().has('floor')).toBe(false);
			expect(params().get('group')).toBe('byggeri');
		});
	});

	describe('applying state from the URL', () => {
		it('applies viewport params directly, without animating', () => {
			window.history.replaceState(null, '', '/?x=0.3&y=0.4&z=2');

			const { engine } = mountSync();

			expect(engine.viewport.center.x).toBe(0.3);
			expect(engine.viewport.center.y).toBe(0.4);
			expect(engine.viewport.scale).toBe(2);
		});

		it('applies floor, group, selection, origin, and layers', () => {
			window.history.replaceState(
				null,
				'',
				'/?floor=1&group=byggeri&point=title-point&origin=icon-point&layers=parking:1'
			);

			const { engine } = mountSync();

			expect(engine.selectedFloor).toBe(engine.floors[1]);
			expect(engine.selectedGroup?.id).toBe('byggeri');
			expect(engine.points[0].selectedAsDestination).toBe(true);
			expect(engine.points[2].selectedAsOrigin).toBe(true);
			expect(
				engine.layers.find((candidate) => candidate.name === 'parking')
					?.visible
			).toBe(true);
		});

		it('lets an explicit viewport param win over selection side-effect animations', () => {
			window.history.replaceState(
				null,
				'',
				'/?point=title-point&x=0.9&z=7'
			);

			const { engine } = mountSync();

			expect(engine.points[0].selectedAsDestination).toBe(true);
			expect(engine.viewport.center.x).toBe(0.9);
			expect(engine.viewport.scale).toBe(7);
		});

		it('clamps malformed viewport params', () => {
			window.history.replaceState(null, '', '/?x=abc&y=7&z=-3');

			const { engine } = mountSync();

			expect(engine.viewport.center.x).toBe(0.5);
			expect(engine.viewport.center.y).toBe(1);
			expect(engine.viewport.scale).toBe(engine.viewport.minScale);
		});

		it('ignores params for unknown ids', () => {
			window.history.replaceState(
				null,
				'',
				'/?point=missing&group=missing&layers=missing:1'
			);

			const { engine } = mountSync();

			expect(
				engine.points.some(
					(candidate) => candidate.selectedAsDestination
				)
			).toBe(false);
			expect(engine.selectedGroup).toBeNull();
		});

		it('honors the param prefix when reading', () => {
			window.history.replaceState(null, '', '/?map_x=0.3&x=0.9');

			const { engine } = mountSync({ paramPrefix: 'map_' });

			expect(engine.viewport.center.x).toBe(0.3);
		});

		it('skips reading categories that are switched off', () => {
			window.history.replaceState(null, '', '/?x=0.3&floor=1');

			const { engine } = mountSync({ syncViewport: false });

			expect(engine.viewport.center.x).toBe(0.5);
			expect(engine.selectedFloor).toBe(engine.floors[1]);
		});
	});
});
