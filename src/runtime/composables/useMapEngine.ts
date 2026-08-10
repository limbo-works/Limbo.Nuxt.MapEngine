import { reactive, watch } from 'vue';

import useMapViewport from './useMapViewport';
import { isPointInGroup } from '../utils/points';
import { normalizeSearchText } from '../utils/search';
import type {
	IEngine,
	IEngineFocusAnimation,
	IEngineOptions,
	IFloor,
	IGroup,
	IPoint,
	ILayer,
	IToggleableLayer,
} from '../types';

const defaultFocusScale = 5;

// Spring from the Figma motion spec — the same curve the content overlay's
// CSS slide ships as linear(), so panel and viewport move as one:
// 1 - e^(-11.18t) * (cos(0.158t) + 70.71 * sin(0.158t))
const defaultFocusAnimation: IEngineFocusAnimation = {
	duration: 750,
	easing: (x: number) =>
		x >= 1
			? 1
			: 1 -
				Math.exp(-11.18 * x) *
					(Math.cos(0.158 * x) + 70.71 * Math.sin(0.158 * x)),
};

export default (options: IEngineOptions = {}): IEngine => {
	const layers: ILayer[] = [];
	const points: IPoint[] = [];
	const groups: IGroup[] = [];
	const floors: IFloor[] = [];

	const engine = reactive<IEngine>({
		viewport: useMapViewport({ ...options.viewport, layers }),
		layers,
		points,
		groups,
		floors,
		selectedFloor: null,
		selectedGroup: null,
		focusScale: options.focusScale ?? defaultFocusScale,
		focusAnimation: {
			duration:
				options.focusAnimation?.duration ??
				defaultFocusAnimation.duration,
			easing:
				options.focusAnimation?.easing ?? defaultFocusAnimation.easing,
		},

		selectPoint,
		activatePoint,
		selectOriginPoint,
		searchPoints,
		selectFloor,
		getAvailableFloors,
		selectGroup,
		getGroupPoints,
		toggleLayer,
		toggleGroup,
		getToggleableLayers,
		isLayerVisible,
	});

	// The floor switcher hides itself once no floor is in-range at the
	// current zoom (see getAvailableFloors) — resetting to the ground floor
	// here means it doesn't silently reappear on some other floor after the
	// user zooms back in, which would be confusing.
	watch(
		() => getAvailableFloors().length,
		(length) => {
			if (length === 0) {
				selectFloor(engine.floors[0] ?? null);
			}
		}
	);

	function selectPoint(point: IPoint | null) {
		if (point?.selectedAsDestination) {
			return;
		}

		// A changed or cleared destination invalidates the current
		// origin pairing, so pseudo-wayfinding resets alongside it
		clearOriginSelection();

		for (const other of engine.points) {
			other.selectedAsDestination = false;
		}

		// A new (or cleared) selection drops any layer revealed for the
		// previous one before revealing the new point's layer below
		clearRevealedLayer();

		if (point) {
			// Non-clickable points (SoW §3.3's bare icons) are excluded from
			// search and grouping, but programmatic selection still frames
			// them — without ever carrying the highlighted state
			if (point.clickable) {
				point.selectedAsDestination = true;
			}

			// Make the point's own layer visible (switch floor, force-show a
			// toggled-off parking/routes layer) so it isn't selected-but-hidden,
			// then frame it at a scale where that layer is actually in range
			revealPointLayer(point);

			engine.viewport.zoomTo(
				point.position,
				pointFocusScale(point),
				engine.focusAnimation
			);
		}

		updateBuildingHighlights();
	}

	// Second click on the selected point triggers its action; first click
	// only selects. The engine has no notion of what that action is (a
	// content overlay, a link, anything else) — that's entirely up to the
	// consumer-supplied onActivatePoint callback (SoW §3.3).
	function activatePoint(point: IPoint) {
		if (!point.clickable) {
			return;
		}

		if (!point.selectedAsDestination) {
			selectPoint(point);
			return;
		}

		options.onActivatePoint?.(point);
	}

	function selectOriginPoint(point: IPoint | null) {
		if (point?.selectedAsOrigin) {
			return;
		}

		const hadOrigin = engine.points.some((other) => other.selectedAsOrigin);
		const destination = engine.points.find(
			(other) => other.selectedAsDestination
		);

		clearOriginSelection();

		if (point) {
			point.selectedAsOrigin = true;

			if (destination) {
				const routes = getWalkingRoutesLayer();
				if (routes) {
					routes.forceVisible = true;
				}

				engine.viewport.fitToPoints(
					[destination.position, point.position],
					{ ...engine.focusAnimation, maxScale: engine.focusScale }
				);
			}
		} else if (hadOrigin && destination) {
			engine.viewport.zoomTo(
				destination.position,
				engine.focusScale,
				engine.focusAnimation
			);
		}

		updateBuildingHighlights();
	}

	function searchPoints(query: string): IPoint[] {
		const normalized = normalizeSearchText(query);
		if (!normalized) {
			return [];
		}

		const labelMatches: IPoint[] = [];
		const tagMatches: IPoint[] = [];

		// SoW §3.3: only clickable POIs take part in search — bare icons
		// (custom icon without content/link) are purely decorative
		for (const point of engine.points) {
			if (!point.clickable) {
				continue;
			}

			if (normalizeSearchText(point.label).includes(normalized)) {
				labelMatches.push(point);
			} else if (
				point.tags.some((tag) =>
					normalizeSearchText(tag).includes(normalized)
				)
			) {
				tagMatches.push(point);
			}
		}

		return [...labelMatches, ...tagMatches];
	}

	function clearOriginSelection() {
		for (const other of engine.points) {
			other.selectedAsOrigin = false;
		}

		const routes = getWalkingRoutesLayer();
		if (routes) {
			routes.forceVisible = false;
		}
	}

	function getWalkingRoutesLayer(): ILayer | undefined {
		return engine.layers.find((layer) => layer.kind === 'walking-routes');
	}

	// Building-highlight layers (kind: 'building-highlight') are matched to
	// points by ILayer.name — a point's `buildings` entries are those names.
	// A layer is shown while any point naming it is selected as destination
	// or origin, so both roles light up the same building independently.
	function updateBuildingHighlights() {
		const activeBuildings = new Set(
			engine.points
				.filter(
					(point) =>
						point.selectedAsDestination || point.selectedAsOrigin
				)
				.flatMap((point) => point.buildings)
		);

		for (const layer of engine.layers) {
			if (layer.kind !== 'building-highlight') {
				continue;
			}

			layer.forceVisible = activeBuildings.has(layer.name);
		}
	}

	function toggleLayer(layer: ILayer) {
		layer.visible = !layer.visible;
	}

	function toggleGroup(group: IGroup) {
		if (engine.selectedGroup === group) {
			engine.selectedGroup = null;
			return;
		}

		engine.selectGroup(group);
	}

	function getToggleableLayers(): IToggleableLayer[] {
		return engine.layers.filter(
			(layer): layer is IToggleableLayer => layer.label !== undefined
		);
	}

	function selectFloor(floor: IFloor | null) {
		engine.selectedFloor = floor;
	}

	function selectGroup(group: IGroup | null) {
		engine.selectedGroup = group;

		if (group) {
			// Selecting a group frames its own points, so any previously
			// selected destination/origin pairing is cleared rather than left
			// stranded outside the new frame
			selectPoint(null);

			engine.viewport.fitToPoints(
				getGroupPoints(group).map((point) => point.position),
				{
					...engine.focusAnimation,
					maxScale: engine.focusScale,
					// padding: 100,
				}
			);
		}
	}

	function getGroupPoints(group: IGroup): IPoint[] {
		return engine.points.filter((point) => isPointInGroup(point, group));
	}

	// A layer force-shown to reveal the currently selected point (see
	// revealPointLayer) — tracked so it reverts when the selection changes.
	let revealedLayer: ILayer | null = null;

	function findLayer(name: string): ILayer | undefined {
		return engine.layers.find((candidate) => candidate.name === name);
	}

	// Selecting a point makes its layer visible: switch to the layer's floor
	// and force-show a toggled-off layer (parking, walking routes). Floor layers
	// are revealed by floor selection + zoom rather than forceVisible, since
	// they're always `visible` and only gated by floor/scale.
	function revealPointLayer(point: IPoint) {
		if (!point.layer) {
			return;
		}

		const layer = findLayer(point.layer);
		if (!layer) {
			return;
		}

		if (layer.floor !== undefined) {
			const floor = engine.floors.find(
				(candidate) => candidate.id === layer.floor
			);
			if (floor) {
				selectFloor(floor);
			}
		}

		if (!layer.visible) {
			layer.forceVisible = true;
			revealedLayer = layer;
		}
	}

	function clearRevealedLayer() {
		if (revealedLayer) {
			revealedLayer.forceVisible = false;
			revealedLayer = null;
		}
	}

	// Frame scale for a selected point: deep enough that its layer is in range
	// (past the layer's minScale feather), else the shared focusScale.
	function pointFocusScale(point: IPoint): number {
		if (!point.layer) {
			return engine.focusScale;
		}

		const layer = findLayer(point.layer);
		const minScale = layer?.sprite.minScale;
		if (layer === undefined || minScale === undefined) {
			return engine.focusScale;
		}

		return Math.max(
			engine.focusScale,
			minScale + layer.sprite.scaleFeather
		);
	}

	// Mirrors MapLayer's own visibility gate: the v-if (visible/forceVisible +
	// floor match) plus setOpacity's in-range test — a layer faded to 0 by its
	// minScale/maxScale threshold counts as not shown. Used to gate points tied
	// to a layer (IPoint.layer) so they appear and disappear with it.
	function isLayerVisible(name: string): boolean {
		const layer = findLayer(name);
		if (!layer) {
			return true;
		}

		const shown =
			(layer.visible || layer.forceVisible) &&
			(layer.floor === undefined ||
				layer.floor === engine.selectedFloor?.id);
		if (!shown) {
			return false;
		}

		const { minScale, maxScale, scaleFeather } = layer.sprite;
		const { scale } = engine.viewport;
		if (minScale && scale < minScale - scaleFeather) {
			return false;
		}
		if (maxScale && scale > maxScale + scaleFeather) {
			return false;
		}

		return true;
	}

	function getAvailableFloors(): IFloor[] {
		const availableIds = new Set<string>();

		for (const layer of engine.layers) {
			if (layer.floor === undefined) {
				continue;
			}

			const { minScale } = layer.sprite;
			if (minScale !== undefined && minScale <= engine.viewport.scale) {
				availableIds.add(layer.floor);
			}
		}

		// Display order follows engine.floors' authored order, not the
		// (arbitrary) order layers were pushed in
		return engine.floors.filter((floor) => availableIds.has(floor.id));
	}

	return engine;
};
