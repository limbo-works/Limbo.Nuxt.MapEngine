import { onMounted, watch } from 'vue';
import { clamp } from '../utils/math';
import type { IEngine, IPoint, IUrlSync, IUrlSyncOptions } from '../types';

const defaultDebounce = 100;

// Rounded before comparing/serializing so imperceptible floating-point
// drift from animation easing never counts as a divergence from baseline.
const centerPrecision = 4;
const scalePrecision = 2;

/**
 * Reads recognized query params into the engine (composing with whatever
 * initial state the consumer already configured — IViewportOptions
 * center/scale, engine.selectFloor calls, etc. — made before this is
 * called), then keeps the URL in sync with the engine afterwards.
 *
 * Only ever writes params for state that diverges from what the engine
 * looked like at the moment this composable ran, so a page with no query
 * string still reflects the consumer's own defaults exactly, and sharing a
 * URL never carries more state than was actually changed by the user.
 *
 * SSR-safe: reading/writing the URL is deferred to `onMounted` rather than
 * applied synchronously during setup, even though the browser APIs it
 * needs are only unavailable during SSR anyway. Applying it synchronously
 * would mean the client's very first render already differs from what the
 * server rendered (SSR never sees the URL's state) — a real hydration
 * mismatch, and Vue does not rectify mismatched class/style/structural
 * bindings during hydration, only warns. Deferring to `onMounted` makes
 * the client's first render match the SSR snapshot exactly (clean
 * hydration), then applies the URL state as an ordinary post-mount
 * reactive update, which every component updates correctly for.
 */
export default (engine: IEngine, options: IUrlSyncOptions = {}): IUrlSync => {
	if (typeof window === 'undefined') {
		return { pause() {}, resume() {} };
	}

	const prefix = options.paramPrefix ?? '';
	const debounceMs = options.debounce ?? defaultDebounce;
	const syncViewport = options.syncViewport ?? true;
	const syncFloor = options.syncFloor ?? true;
	const syncGroup = options.syncGroup ?? true;
	const syncSelection = options.syncSelection ?? true;
	const syncLayers = options.syncLayers ?? true;

	const key = (name: string) => `${prefix}${name}`;
	const managedKeys = [
		'x',
		'y',
		'z',
		'floor',
		'group',
		'point',
		'origin',
		'layers',
	].map(key);

	const baseline = {
		x: round(engine.viewport.center.x, centerPrecision),
		y: round(engine.viewport.center.y, centerPrecision),
		scale: round(engine.viewport.scale, scalePrecision),
		floor: engine.selectedFloor?.id ?? null,
		group: engine.selectedGroup?.id ?? null,
		point: findId(engine, (point) => point.selectedAsDestination),
		origin: findId(engine, (point) => point.selectedAsOrigin),
		layers: captureLayerVisibility(engine),
	};

	onMounted(applyFromUrl);

	let active = true;
	let timeout: ReturnType<typeof setTimeout> | undefined;

	watch(
		() => JSON.stringify(computeEntries()),
		() => {
			if (!active) {
				return;
			}

			clearTimeout(timeout);
			timeout = setTimeout(writeToUrl, debounceMs);
		}
	);

	function pause() {
		active = false;
		clearTimeout(timeout);
	}

	function resume() {
		active = true;
	}

	function computeEntries(): [string, string][] {
		const entries: [string, string][] = [];

		if (syncViewport) {
			const x = round(engine.viewport.center.x, centerPrecision);
			const y = round(engine.viewport.center.y, centerPrecision);
			const scale = round(engine.viewport.scale, scalePrecision);

			if (x !== baseline.x) {
				entries.push([key('x'), String(x)]);
			}
			if (y !== baseline.y) {
				entries.push([key('y'), String(y)]);
			}
			if (scale !== baseline.scale) {
				entries.push([key('z'), String(scale)]);
			}
		}

		if (syncFloor) {
			const floor = engine.selectedFloor?.id ?? null;
			if (floor !== baseline.floor) {
				entries.push([key('floor'), floor ?? '']);
			}
		}

		if (syncGroup) {
			const group = engine.selectedGroup?.id ?? null;
			if (group !== baseline.group) {
				entries.push([key('group'), group ?? '']);
			}
		}

		if (syncSelection) {
			const point = findId(engine, (p) => p.selectedAsDestination);
			const origin = findId(engine, (p) => p.selectedAsOrigin);

			if (point !== baseline.point) {
				entries.push([key('point'), point ?? '']);
			}
			if (origin !== baseline.origin) {
				entries.push([key('origin'), origin ?? '']);
			}
		}

		if (syncLayers) {
			const current = captureLayerVisibility(engine);
			const diverging: string[] = [];

			for (const [name, visible] of current) {
				if (baseline.layers.get(name) !== visible) {
					diverging.push(`${name}:${visible ? 1 : 0}`);
				}
			}

			if (diverging.length) {
				entries.push([key('layers'), diverging.join(',')]);
			}
		}

		return entries;
	}

	function writeToUrl() {
		const url = new URL(window.location.href);

		for (const managedKey of managedKeys) {
			url.searchParams.delete(managedKey);
		}

		for (const [entryKey, value] of computeEntries()) {
			url.searchParams.set(entryKey, value);
		}

		window.history.replaceState(window.history.state, '', url.toString());
	}

	// Applied in a fixed order: floor/group/selection first (selectGroup,
	// selectPoint, and selectOriginPoint each trigger their own animated
	// viewport move), then any explicit viewport override last, so a
	// restored view always wins over those side-effect animations —
	// selectPoint before selectOriginPoint specifically, since selectPoint
	// clears any existing origin pairing as a side effect.
	function applyFromUrl() {
		const params = new URLSearchParams(window.location.search);

		if (syncFloor && params.has(key('floor'))) {
			const raw = params.get(key('floor'));
			engine.selectFloor(
				raw ? (engine.floors.find((f) => f.id === raw) ?? null) : null
			);
		}

		if (syncGroup && params.has(key('group'))) {
			const raw = params.get(key('group'));
			engine.selectGroup(
				raw ? (engine.groups.find((g) => g.id === raw) ?? null) : null
			);
		}

		if (syncSelection) {
			if (params.has(key('point'))) {
				engine.selectPoint(findPoint(engine, params.get(key('point'))));
			}

			if (params.has(key('origin'))) {
				engine.selectOriginPoint(
					findPoint(engine, params.get(key('origin')))
				);
			}
		}

		if (syncLayers && params.has(key('layers'))) {
			const raw = params.get(key('layers')) ?? '';

			for (const entry of raw.split(',')) {
				if (!entry) {
					continue;
				}

				const [name, flag] = entry.split(':');
				const layer = engine.layers.find((l) => l.name === name);
				if (layer) {
					layer.visible = flag === '1';
				}
			}
		}

		if (syncViewport) {
			const hasX = params.has(key('x'));
			const hasY = params.has(key('y'));
			const hasZ = params.has(key('z'));

			if (hasX || hasY || hasZ) {
				engine.viewport.stop();

				if (hasX) {
					engine.viewport.center.x = clampUnit(
						Number(params.get(key('x')))
					);
				}
				if (hasY) {
					engine.viewport.center.y = clampUnit(
						Number(params.get(key('y')))
					);
				}
				if (hasZ) {
					engine.viewport.scale = clampScale(
						Number(params.get(key('z'))),
						engine.viewport.minScale,
						engine.viewport.maxScale
					);
				}
			}
		}
	}

	return { pause, resume };
};

function findId(
	engine: IEngine,
	predicate: (point: IPoint) => boolean
): string | null {
	return engine.points.find(predicate)?.id ?? null;
}

function findPoint(engine: IEngine, id: string | null): IPoint | null {
	if (!id) {
		return null;
	}

	return engine.points.find((point) => point.id === id) ?? null;
}

function captureLayerVisibility(engine: IEngine): Map<string, boolean> {
	return new Map(
		engine.getToggleableLayers().map((layer) => [layer.name, layer.visible])
	);
}

function round(value: number, precision: number): number {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
}

function clampUnit(value: number): number {
	return Number.isFinite(value) ? clamp(value, 0, 1) : 0.5;
}

function clampScale(value: number, min: number, max: number): number {
	return Number.isFinite(value) ? clamp(value, min, max) : min;
}
