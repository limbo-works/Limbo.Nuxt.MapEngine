import type { IVector } from './geometry';

export interface IPoint {
	// Stable identifier, author-supplied — the URL-sync composable
	// references selected/origin points by this id, so it must stay stable
	// across reloads (unlike array index, which shifts if points are
	// added/removed/reordered).
	id: string;
	label: string;
	tags: string[];
	groups: string[];
	// Building-highlight layer names (see ILayer.name for kind:
	// 'building-highlight' layers) shown while this point is selected as
	// destination or origin.
	buildings: string[];
	// Opaque, consumer-defined payload — the engine has no notion of what a
	// point's content is or what activating it does (overlay blocks, a
	// link, anything else); that's entirely up to the consumer and
	// IEngineOptions.onActivatePoint.
	content?: unknown;
	// Whether the point takes part in selection, search, and grouping.
	// Authored rather than derived, since the engine no longer knows
	// anything about a point's content to derive it from (SoW §3.3's bare
	// icons author this as false).
	clickable: boolean;
	// Name of the ILayer this point belongs to. When set, the point is only
	// shown while that layer is shown (engine.isLayerVisible) — a point on a
	// floor layer hides when that floor isn't selected or is out of scale
	// range, same as the layer's own sprite. Undefined = always eligible.
	layer?: string;
	position: IVector;
	visible: boolean;
	selectedAsDestination: boolean;
	selectedAsOrigin: boolean;
	// Transform anchor for the rendered marker in [0, 1] of its own box —
	// authored, defaulting to the pin's bottom-center when unset.
	anchor?: IVector;
}

export interface IPointOptions {
	id: string;
	label: string;
	tags?: string[];
	groups?: string[];
	buildings?: string[];
	content?: unknown;
	clickable?: boolean;
	layer?: string;
	anchor?: IVector;
	x?: number;
	y?: number;
	visible?: boolean;
}
