import type { ISprite } from './sprite';

// Special-purpose layer roles: 'walking-routes' is force-shown while
// pseudo-wayfinding has both an origin and destination selected;
// 'building-highlight' layers are matched to IPoint.buildings by name and
// force-shown while a matching point is selected.
export type LayerKind = 'walking-routes' | 'building-highlight';

export interface ILayer {
	visible: boolean;
	// Set only for the walking-routes layer while pseudo-wayfinding has both
	// an origin and destination selected — independent of `visible` so a
	// manual toggle-off isn't silently overwritten, and reverts on its own
	// once wayfinding ends. Never authored, same category as
	// IPoint.selectedAsDestination.
	forceVisible?: boolean;
	name: string;
	// A layer is toggleable (shows up as a pill) if and only if it has a label.
	label?: string;
	color?: string;
	kind?: LayerKind;
	// References IFloor.id — a layer with no floor is shown on every floor.
	floor?: string;
	sprite: ISprite;
}

// The subset of ILayer that engine.getToggleableLayers() returns — label
// narrowed to defined, since that's exactly the filter it applies.
export type IToggleableLayer = ILayer & { label: string };

export interface ILayerOptions {
	name: string;
	sprite: string;

	label?: string;
	color?: string;
	// Initial toggle state for a labeled layer. Defaults to false ("mostly
	// off"); ignored for layers without a label, which are always visible.
	enabled?: boolean;
	kind?: LayerKind;
	floor?: string;
	minScale?: number;
	maxScale?: number;
	scaleFeather?: number;
	scaleFactor?: number;
	scaleOrigin?: string;
}
