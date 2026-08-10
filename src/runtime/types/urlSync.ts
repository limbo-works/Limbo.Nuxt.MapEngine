export interface IUrlSyncOptions {
	// Prepended to every query key this composable owns (e.g. `map_x`
	// instead of `x`) — avoids collisions when the map shares a URL with
	// other query params. Defaults to no prefix.
	paramPrefix?: string;
	// Milliseconds of quiet after the last change before the URL is
	// rewritten. Viewport pans/animations mutate center/scale every frame,
	// so this exists to avoid replaceState spam mid-gesture.
	debounce?: number;
	syncViewport?: boolean;
	syncFloor?: boolean;
	syncGroup?: boolean;
	// Covers selected point and origin point together — both key off the
	// same point-id lookup.
	syncSelection?: boolean;
	syncLayers?: boolean;
}

export interface IUrlSync {
	// Suspends writing engine state to the URL (reading on setup already
	// happened by the time either of these is callable). Does not affect
	// engine state itself.
	pause(): void;
	resume(): void;
}
