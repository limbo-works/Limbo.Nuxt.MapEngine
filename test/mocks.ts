import { vi } from 'vitest';

/**
 * Deterministic requestAnimationFrame driver. `performance.now()` is pinned
 * to the same clock, so `onUpdate`'s delta math and the viewport's tweens
 * advance exactly as far as the frames pushed through `frame()`.
 */
let now = 0;
let nextFrameId = 1;
let pending = new Map<number, FrameRequestCallback>();

export function installFrameMock(): void {
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		const id = nextFrameId++;
		pending.set(id, callback);
		return id;
	});

	vi.stubGlobal('cancelAnimationFrame', (id: number) => {
		pending.delete(id);
	});

	vi.spyOn(performance, 'now').mockImplementation(() => now);
}

export function resetFrames(): void {
	now = 0;
	nextFrameId = 1;
	pending = new Map();
}

// Runs one animation frame: advances the shared clock, then flushes the
// callbacks that were queued before this frame started (callbacks queued
// during the flush land in the next frame, matching browser semantics).
export function frame(delta = 16): void {
	now += delta;

	const callbacks = pending;
	pending = new Map();

	for (const callback of callbacks.values()) {
		callback(now);
	}
}

export function frames(count: number, delta = 16): void {
	for (let index = 0; index < count; index++) {
		frame(delta);
	}
}

/**
 * ResizeObserver mock — jsdom has none. Instances register themselves so a
 * test can push a fake resize through `triggerResize`.
 */
type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

const resizeObservers: {
	callback: ResizeCallback;
	targets: Set<Element>;
}[] = [];

export function installResizeObserverMock(): void {
	vi.stubGlobal(
		'ResizeObserver',
		class {
			callback: ResizeCallback;
			targets = new Set<Element>();

			constructor(callback: ResizeCallback) {
				this.callback = callback;
				resizeObservers.push(this);
			}

			observe(target: Element) {
				this.targets.add(target);
			}

			unobserve(target: Element) {
				this.targets.delete(target);
			}

			disconnect() {
				this.targets.clear();
			}
		}
	);
}

export function resetResizeObservers(): void {
	resizeObservers.length = 0;
}

export function triggerResize(
	target: Element,
	size: { width: number; height: number }
): void {
	for (const observer of resizeObservers) {
		if (!observer.targets.has(target)) {
			continue;
		}

		observer.callback([
			{
				target,
				contentRect: { width: size.width, height: size.height },
			} as unknown as ResizeObserverEntry,
		]);
	}
}

/**
 * matchMedia mock — `setMatchMedia` flips what queries report and notifies
 * registered change listeners (MapGroupList's mobile switch, MapSearch's
 * coarse-pointer check).
 */
let mediaMatcher: (query: string) => boolean = () => false;

const mediaQueryLists: {
	query: string;
	listeners: Set<(event: { matches: boolean }) => void>;
	matches: boolean;
}[] = [];

export function installMatchMediaMock(): void {
	vi.stubGlobal('matchMedia', (query: string) => {
		const entry = {
			query,
			listeners: new Set<(event: { matches: boolean }) => void>(),
			matches: mediaMatcher(query),
		};
		mediaQueryLists.push(entry);

		return {
			get matches() {
				return entry.matches;
			},
			media: query,
			addEventListener(
				_type: string,
				listener: (event: { matches: boolean }) => void
			) {
				entry.listeners.add(listener);
			},
			removeEventListener(
				_type: string,
				listener: (event: { matches: boolean }) => void
			) {
				entry.listeners.delete(listener);
			},
		};
	});
}

export function setMatchMedia(matcher: (query: string) => boolean): void {
	mediaMatcher = matcher;

	for (const entry of mediaQueryLists) {
		const matches = matcher(entry.query);
		if (matches === entry.matches) {
			continue;
		}

		entry.matches = matches;
		for (const listener of entry.listeners) {
			listener({ matches });
		}
	}
}

export function resetMatchMedia(): void {
	mediaMatcher = () => false;
	mediaQueryLists.length = 0;
}
