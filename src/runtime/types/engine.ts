import type {
	IViewport,
	IViewportAnimationOptions,
	IViewportOptions,
} from './viewport';
import type { ILayer, IToggleableLayer } from './layer';
import type { IPoint } from './point';
import type { IGroup } from './group';
import type { IFloor } from './floor';

export interface IEngineOptions {
	viewport?: Omit<IViewportOptions, 'layers'>;
	// Zoom level a focused POI is framed at (selection, wayfinding pairs,
	// and group fits all share it). Defaults to 5.
	focusScale?: number;
	// Tween used for those framing moves. Defaults to the Figma motion
	// spec's 750ms spring; unset fields keep their default.
	focusAnimation?: IViewportAnimationOptions;
	// Called when activatePoint's second click hits an already-selected
	// clickable point — the engine has no notion of what a point's action
	// is (content overlay, link, anything else), so this is the only hook
	// into that gesture. Unset means the second click does nothing beyond
	// the selection activatePoint already performed.
	onActivatePoint?: (point: IPoint) => void;
}

// The resolved counterpart of IEngineOptions.focusAnimation — both fields
// always present so consumers (and the engine's own components) can rely
// on them without re-supplying defaults.
export interface IEngineFocusAnimation {
	duration: number;
	easing: (t: number) => number;
}

export interface IEngine {
	viewport: IViewport;
	layers: ILayer[];
	points: IPoint[];
	groups: IGroup[];
	floors: IFloor[];
	selectedFloor: IFloor | null;
	selectedGroup: IGroup | null;
	focusScale: number;
	focusAnimation: IEngineFocusAnimation;

	selectPoint(point: IPoint | null): void;
	activatePoint(point: IPoint): void;
	selectOriginPoint(point: IPoint | null): void;
	searchPoints(query: string): IPoint[];
	selectFloor(floor: IFloor | null): void;
	getAvailableFloors(): IFloor[];
	selectGroup(group: IGroup | null): void;
	getGroupPoints(group: IGroup): IPoint[];
	toggleLayer(layer: ILayer): void;
	toggleGroup(group: IGroup): void;
	getToggleableLayers(): IToggleableLayer[];
	// Whether the layer with this name is currently shown — the same test
	// MapLayer applies to itself: (visible || forceVisible), floor match, and
	// in scale range (not faded to 0 by the sprite's minScale/maxScale). Drives
	// per-point visibility via IPoint.layer. An unknown name returns true, so a
	// point referencing a missing layer stays eligible rather than vanishing.
	isLayerVisible(name: string): boolean;
}
