import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { isPointInGroup } from '../../src/runtime/utils/points';
import { normalizeSearchText } from '../../src/runtime/utils/search';
import type { IEngine, ILayer, IPoint } from '../../src/runtime/types';
import { makeEngine } from '../utils';

function point(engine: IEngine, id: string): IPoint {
	const found = engine.points.find((candidate) => candidate.id === id);
	if (!found) {
		throw new Error(`no point ${id}`);
	}

	return found;
}

function layer(engine: IEngine, name: string): ILayer {
	const found = engine.layers.find((candidate) => candidate.name === name);
	if (!found) {
		throw new Error(`no layer ${name}`);
	}

	return found;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('useMapEngine', () => {
	describe('selectPoint', () => {
		it('marks exactly one point selected and frames it', () => {
			const { engine } = makeEngine();
			const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
			const title = point(engine, 'title-point');

			engine.selectPoint(title);

			expect(title.selectedAsDestination).toBe(true);
			expect(
				engine.points.filter((other) => other.selectedAsDestination)
			).toEqual([title]);
			expect(zoomTo).toHaveBeenCalledWith(
				title.position,
				engine.focusScale,
				engine.focusAnimation
			);
		});

		it('moves the selection on a second select', () => {
			const { engine } = makeEngine();

			engine.selectPoint(point(engine, 'title-point'));
			engine.selectPoint(point(engine, 'link-point'));

			expect(point(engine, 'title-point').selectedAsDestination).toBe(
				false
			);
			expect(point(engine, 'link-point').selectedAsDestination).toBe(
				true
			);
		});

		it('ignores re-selecting the already selected point', () => {
			const { engine } = makeEngine();
			const title = point(engine, 'title-point');
			engine.selectPoint(title);

			const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
			engine.selectPoint(title);

			expect(zoomTo).not.toHaveBeenCalled();
			expect(title.selectedAsDestination).toBe(true);
		});

		it('clears the selection with null', () => {
			const { engine } = makeEngine();
			const title = point(engine, 'title-point');
			engine.selectPoint(title);

			engine.selectPoint(null);

			expect(title.selectedAsDestination).toBe(false);
		});

		it('frames non-clickable points without marking them selected', () => {
			const { engine } = makeEngine();
			const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
			const bare = point(engine, 'bare-point');

			engine.selectPoint(bare);

			expect(bare.selectedAsDestination).toBe(false);
			expect(zoomTo).toHaveBeenCalledWith(
				bare.position,
				engine.focusScale,
				engine.focusAnimation
			);
		});

		it('resets the wayfinding origin when the destination changes', () => {
			const { engine } = makeEngine();
			engine.selectPoint(point(engine, 'title-point'));
			engine.selectOriginPoint(point(engine, 'icon-point'));
			expect(layer(engine, 'routes').forceVisible).toBe(true);

			engine.selectPoint(point(engine, 'link-point'));

			expect(point(engine, 'icon-point').selectedAsOrigin).toBe(false);
			expect(layer(engine, 'routes').forceVisible).toBe(false);
		});
	});

	describe('activatePoint', () => {
		it('selects an unselected point instead of activating it', () => {
			const onActivatePoint = vi.fn();
			const { engine } = makeEngine({ onActivatePoint });
			const link = point(engine, 'link-point');

			engine.activatePoint(link);

			expect(link.selectedAsDestination).toBe(true);
			expect(onActivatePoint).not.toHaveBeenCalled();
		});

		it('invokes onActivatePoint on the second activation', () => {
			const onActivatePoint = vi.fn();
			const { engine } = makeEngine({ onActivatePoint });
			const title = point(engine, 'title-point');

			engine.activatePoint(title);
			engine.activatePoint(title);

			expect(onActivatePoint).toHaveBeenCalledWith(title);
		});

		it('does nothing on the second activation when unset', () => {
			const { engine } = makeEngine();
			const title = point(engine, 'title-point');

			expect(() => {
				engine.activatePoint(title);
				engine.activatePoint(title);
			}).not.toThrow();
		});

		it('ignores non-clickable points entirely', () => {
			const onActivatePoint = vi.fn();
			const { engine } = makeEngine({ onActivatePoint });
			const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
			const bare = point(engine, 'bare-point');

			engine.activatePoint(bare);

			expect(bare.selectedAsDestination).toBe(false);
			expect(zoomTo).not.toHaveBeenCalled();
			expect(onActivatePoint).not.toHaveBeenCalled();
		});
	});

	describe('selectOriginPoint (pseudo-wayfinding)', () => {
		it('marks the origin without framing when no destination is selected', () => {
			const { engine } = makeEngine();
			const fitToPoints = vi.spyOn(engine.viewport, 'fitToPoints');

			engine.selectOriginPoint(point(engine, 'icon-point'));

			expect(point(engine, 'icon-point').selectedAsOrigin).toBe(true);
			expect(fitToPoints).not.toHaveBeenCalled();
			expect(layer(engine, 'routes').forceVisible).toBe(false);
		});

		it('frames origin + destination and force-shows walking routes', () => {
			const { engine } = makeEngine();
			const destination = point(engine, 'title-point');
			const origin = point(engine, 'icon-point');
			engine.selectPoint(destination);

			const fitToPoints = vi.spyOn(engine.viewport, 'fitToPoints');
			engine.selectOriginPoint(origin);

			expect(fitToPoints).toHaveBeenCalledWith(
				[destination.position, origin.position],
				{ ...engine.focusAnimation, maxScale: engine.focusScale }
			);
			expect(layer(engine, 'routes').forceVisible).toBe(true);
		});

		it('returns to the destination when the origin is cleared', () => {
			const { engine } = makeEngine();
			const destination = point(engine, 'title-point');
			engine.selectPoint(destination);
			engine.selectOriginPoint(point(engine, 'icon-point'));

			const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
			engine.selectOriginPoint(null);

			expect(point(engine, 'icon-point').selectedAsOrigin).toBe(false);
			expect(layer(engine, 'routes').forceVisible).toBe(false);
			expect(zoomTo).toHaveBeenCalledWith(
				destination.position,
				engine.focusScale,
				engine.focusAnimation
			);
		});

		it('does not zoom anywhere when clearing an already empty origin', () => {
			const { engine } = makeEngine();
			engine.selectPoint(point(engine, 'title-point'));

			const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
			engine.selectOriginPoint(null);

			expect(zoomTo).not.toHaveBeenCalled();
		});

		it('ignores re-selecting the current origin', () => {
			const { engine } = makeEngine();
			engine.selectPoint(point(engine, 'title-point'));
			engine.selectOriginPoint(point(engine, 'icon-point'));

			const fitToPoints = vi.spyOn(engine.viewport, 'fitToPoints');
			engine.selectOriginPoint(point(engine, 'icon-point'));

			expect(fitToPoints).not.toHaveBeenCalled();
		});
	});

	describe('building highlights', () => {
		it('force-shows the highlight layers named by the selected point', () => {
			const { engine } = makeEngine();

			engine.selectPoint(point(engine, 'title-point'));

			expect(layer(engine, '6').forceVisible).toBe(true);
			expect(layer(engine, '40').forceVisible).toBe(false);
		});

		it('combines destination and origin buildings', () => {
			const { engine } = makeEngine();

			engine.selectPoint(point(engine, 'title-point'));
			engine.selectOriginPoint(point(engine, 'icon-point'));

			expect(layer(engine, '6').forceVisible).toBe(true);
			expect(layer(engine, '40').forceVisible).toBe(true);
		});

		it('clears highlights on deselection', () => {
			const { engine } = makeEngine();

			engine.selectPoint(point(engine, 'title-point'));
			engine.selectPoint(null);

			expect(layer(engine, '6').forceVisible).toBe(false);
		});
	});

	describe('searchPoints', () => {
		it('matches labels case- and diacritic-insensitively', () => {
			const { engine } = makeEngine();

			const results = engine.searchPoints('BAEREDYGTIGT');

			expect(results).toEqual([point(engine, 'title-point')]);
		});

		it('sorts label matches before tag matches', () => {
			const { engine } = makeEngine();
			point(engine, 'link-point').tags.push('Kaffe');

			const results = engine.searchPoints('kaffe');

			expect(results.map((result) => result.id)).toEqual([
				'icon-point',
				'link-point',
			]);
		});

		it('excludes non-clickable points even on a tag match', () => {
			const { engine } = makeEngine();

			expect(engine.searchPoints('Toilet')).toEqual([]);
			expect(engine.searchPoints('Faciliteter')).toEqual([]);
		});

		it('returns nothing for empty or whitespace queries', () => {
			const { engine } = makeEngine();

			expect(engine.searchPoints('')).toEqual([]);
			expect(engine.searchPoints('   ')).toEqual([]);
		});
	});

	describe('floors', () => {
		it('selectFloor stores the floor', () => {
			const { engine } = makeEngine();
			const floor1 = engine.floors[1];

			engine.selectFloor(floor1);
			expect(engine.selectedFloor).toBe(floor1);

			engine.selectFloor(null);
			expect(engine.selectedFloor).toBeNull();
		});

		it('derives available floors from in-range floor layers, in authored order', () => {
			const { engine } = makeEngine();

			engine.viewport.scale = 4;
			expect(engine.getAvailableFloors()).toEqual([]);

			engine.viewport.scale = 5;
			expect(engine.getAvailableFloors()).toEqual(engine.floors);
		});

		it('resets to the first authored floor once no floor is in range', async () => {
			const { engine } = makeEngine();
			engine.viewport.scale = 6;
			await nextTick();
			engine.selectFloor(engine.floors[1]);

			engine.viewport.scale = 2;
			await nextTick();

			expect(engine.selectedFloor).toBe(engine.floors[0]);
		});
	});

	describe('groups', () => {
		it('selectGroup frames the group points and clears the selection', () => {
			const { engine } = makeEngine();
			engine.selectPoint(point(engine, 'title-point'));

			const fitToPoints = vi.spyOn(engine.viewport, 'fitToPoints');
			const group = engine.groups[0];
			engine.selectGroup(group);

			expect(engine.selectedGroup).toBe(group);
			expect(point(engine, 'title-point').selectedAsDestination).toBe(
				false
			);
			expect(fitToPoints).toHaveBeenCalledWith(
				[
					point(engine, 'title-point').position,
					point(engine, 'link-point').position,
				],
				{ ...engine.focusAnimation, maxScale: engine.focusScale }
			);
		});

		it('deselecting a group does not touch the point selection', () => {
			const { engine } = makeEngine();
			engine.selectGroup(engine.groups[0]);
			engine.selectPoint(point(engine, 'title-point'));

			engine.selectGroup(null);

			expect(engine.selectedGroup).toBeNull();
			expect(point(engine, 'title-point').selectedAsDestination).toBe(
				true
			);
		});

		it('toggleGroup selects and deselects', () => {
			const { engine } = makeEngine();
			const group = engine.groups[0];

			engine.toggleGroup(group);
			expect(engine.selectedGroup).toBe(group);

			engine.toggleGroup(group);
			expect(engine.selectedGroup).toBeNull();
		});

		it('getGroupPoints returns only clickable members', () => {
			const { engine } = makeEngine();

			const landbrug = engine.groups[1];
			const members = engine.getGroupPoints(landbrug);

			// bare-point is tagged landbrug but not clickable
			expect(members.map((member) => member.id)).toEqual(['icon-point']);
		});
	});

	describe('layers', () => {
		it('toggleLayer flips visibility', () => {
			const { engine } = makeEngine();
			const parking = layer(engine, 'parking');

			engine.toggleLayer(parking);
			expect(parking.visible).toBe(true);

			engine.toggleLayer(parking);
			expect(parking.visible).toBe(false);
		});

		it('getToggleableLayers returns only labeled layers', () => {
			const { engine } = makeEngine();

			expect(
				engine.getToggleableLayers().map((entry) => entry.name)
			).toEqual(['parking']);
		});
	});
});

describe('isPointInGroup', () => {
	it('requires both clickability and group membership', () => {
		const { engine } = makeEngine();
		const [byggeri, landbrug] = engine.groups;

		expect(isPointInGroup(point(engine, 'title-point'), byggeri)).toBe(
			true
		);
		expect(isPointInGroup(point(engine, 'title-point'), landbrug)).toBe(
			false
		);
		expect(isPointInGroup(point(engine, 'bare-point'), landbrug)).toBe(
			false
		);
	});
});

describe('normalizeSearchText', () => {
	it('lowercases and trims', () => {
		expect(normalizeSearchText('  Kaffebar  ')).toBe('kaffebar');
	});

	it('substitutes Danish æ/ø/å', () => {
		expect(normalizeSearchText('Æblegrød på Ås')).toBe('aeblegrod pa as');
	});

	it('strips decomposable diacritics', () => {
		expect(normalizeSearchText('Café Über')).toBe('cafe uber');
	});
});

describe('focus configuration', () => {
	it('defaults to scale 5 and the 750ms spring', () => {
		const { engine } = makeEngine();

		expect(engine.focusScale).toBe(5);
		expect(engine.focusAnimation.duration).toBe(750);
		expect(engine.focusAnimation.easing(1)).toBe(1);
	});

	it('accepts focusScale and partial focusAnimation options', () => {
		const easing = (t: number) => t;
		const { engine } = makeEngine({
			focusScale: 8,
			focusAnimation: { duration: 300 },
		});

		expect(engine.focusScale).toBe(8);
		expect(engine.focusAnimation.duration).toBe(300);
		// Unset fields keep their defaults
		expect(engine.focusAnimation.easing(1)).toBe(1);

		const custom = makeEngine({ focusAnimation: { easing } });
		expect(custom.engine.focusAnimation.easing).toBe(easing);
		expect(custom.engine.focusAnimation.duration).toBe(750);
	});

	it('frames selections with the configured focus values', () => {
		const { engine } = makeEngine({
			focusScale: 8,
			focusAnimation: { duration: 300 },
		});
		const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');

		engine.selectPoint(point(engine, 'title-point'));

		expect(zoomTo).toHaveBeenCalledWith(
			point(engine, 'title-point').position,
			8,
			engine.focusAnimation
		);
	});

	it('honors runtime changes to the focus fields', () => {
		const { engine } = makeEngine();
		const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');

		engine.focusScale = 12;
		engine.selectPoint(point(engine, 'title-point'));

		expect(zoomTo).toHaveBeenCalledWith(
			point(engine, 'title-point').position,
			12,
			engine.focusAnimation
		);
	});

	describe('selectPoint layer reveal', () => {
		it('switches to the floor of the selected point layer', () => {
			const { engine } = makeEngine();
			engine.selectFloor(engine.floors[0]);
			const p = point(engine, 'title-point');
			p.layer = 'floor-1';

			engine.selectPoint(p);

			expect(engine.selectedFloor?.id).toBe('1');
		});

		it('frames the point deep enough for its layer to be in range', () => {
			const { engine } = makeEngine();
			const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
			const p = point(engine, 'title-point');
			// floor-1 has minScale 5, scaleFeather 1 -> framed at 6
			p.layer = 'floor-1';

			engine.selectPoint(p);

			expect(zoomTo).toHaveBeenCalledWith(
				p.position,
				6,
				engine.focusAnimation
			);
		});

		it('force-shows a toggled-off layer and reverts on deselect', () => {
			const { engine } = makeEngine();
			const parking = layer(engine, 'parking');
			expect(parking.visible).toBe(false);

			const p = point(engine, 'title-point');
			p.layer = 'parking';

			engine.selectPoint(p);
			expect(parking.forceVisible).toBe(true);

			engine.selectPoint(null);
			expect(parking.forceVisible).toBe(false);
		});

		it('frames a layerless point at the plain focus scale', () => {
			const { engine } = makeEngine();
			const zoomTo = vi.spyOn(engine.viewport, 'zoomTo');
			const p = point(engine, 'title-point');

			engine.selectPoint(p);

			expect(zoomTo).toHaveBeenCalledWith(
				p.position,
				engine.focusScale,
				engine.focusAnimation
			);
		});
	});

	describe('isLayerVisible', () => {
		it('reports an always-on layer visible', () => {
			const { engine } = makeEngine();

			expect(engine.isLayerVisible('base')).toBe(true);
		});

		it('reports true for an unknown layer name', () => {
			const { engine } = makeEngine();

			expect(engine.isLayerVisible('does-not-exist')).toBe(true);
		});

		it('tracks a toggleable layer through its toggle', () => {
			const { engine } = makeEngine();

			expect(engine.isLayerVisible('parking')).toBe(false);

			engine.toggleLayer(layer(engine, 'parking'));
			expect(engine.isLayerVisible('parking')).toBe(true);
		});

		it('follows forceVisible independent of visible', () => {
			const { engine } = makeEngine();

			layer(engine, 'routes').forceVisible = true;
			expect(engine.isLayerVisible('routes')).toBe(true);
		});

		it('gates a floor layer on the selected floor', () => {
			const { engine } = makeEngine();
			engine.viewport.scale = 5;

			expect(engine.isLayerVisible('floor-0')).toBe(false);

			engine.selectFloor(engine.floors[0]);
			expect(engine.isLayerVisible('floor-0')).toBe(true);
			expect(engine.isLayerVisible('floor-1')).toBe(false);
		});

		it('hides an in-floor layer that is out of scale range', () => {
			const { engine } = makeEngine();
			engine.selectFloor(engine.floors[0]);

			// floor-0 has minScale 5; default scale 1 is below minScale - feather
			engine.viewport.scale = 1;
			expect(engine.isLayerVisible('floor-0')).toBe(false);

			engine.viewport.scale = 5;
			expect(engine.isLayerVisible('floor-0')).toBe(true);
		});
	});
});
