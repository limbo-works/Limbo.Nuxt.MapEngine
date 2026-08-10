import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import MapPoint from '../../src/runtime/components/MapPoint.vue';
import type { IEngine, IPoint } from '../../src/runtime/types';
import { makeEngine } from '../utils';

function mountPoint(engine: IEngine, point: IPoint) {
	return mount(MapPoint, {
		props: { point, engine },
		slots: { default: '<span class="test-content"></span>' },
	});
}

// Visibility is a class toggle (.c-map-point--hidden fades opacity/visibility)
// rather than v-show — read the class, which is deterministic in jsdom where
// getComputedStyle doesn't apply stylesheet rules.
function isShown(wrapper: ReturnType<typeof mountPoint>): boolean {
	return !wrapper.classes().includes('c-map-point--hidden');
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('MapPoint', () => {
	it('renders the slot with the point as scope', () => {
		const { engine } = makeEngine();
		const wrapper = mount(MapPoint, {
			props: { point: engine.points[0], engine },
			slots: {
				default: `<template #default="{ point }">
					<span class="test-content">{{ point.label }}</span>
				</template>`,
			},
		});

		expect(wrapper.find('.test-content').text()).toBe(
			'Bæredygtigt byggeri'
		);
	});

	it('routes clicks to engine.activatePoint', async () => {
		const { engine } = makeEngine();
		const activatePoint = vi.spyOn(engine, 'activatePoint');
		const wrapper = mountPoint(engine, engine.points[0]);

		await wrapper.trigger('click');

		expect(activatePoint).toHaveBeenCalledWith(engine.points[0]);
	});

	it('positions itself at the point in screen space', () => {
		const { engine } = makeEngine();
		const wrapper = mountPoint(engine, engine.points[0]);
		const element = wrapper.element as HTMLElement;

		// world (200, 200) at base scale 0.8 in an 800x600 viewport
		expect(element.style.transform).toContain('translate(160px, 60px)');
	});

	it('repositions when the viewport moves', async () => {
		const { engine } = makeEngine();
		const wrapper = mountPoint(engine, engine.points[0]);
		const element = wrapper.element as HTMLElement;

		engine.viewport.center.x = 0.2;
		await nextTick();

		// (200 - 200) * 0.8 + 400
		expect(element.style.transform).toContain('translate(400px, 60px)');
	});

	it('marks selected and origin-selected points as highlighted', async () => {
		const { engine } = makeEngine();
		const point = engine.points[0];
		const wrapper = mountPoint(engine, point);
		expect(wrapper.classes()).not.toContain('c-map-point--highlighted');

		point.selectedAsDestination = true;
		await nextTick();
		expect(wrapper.classes()).toContain('c-map-point--highlighted');

		point.selectedAsDestination = false;
		point.selectedAsOrigin = true;
		await nextTick();
		expect(wrapper.classes()).toContain('c-map-point--highlighted');
	});

	it('marks bare icons as non-clickable', () => {
		const { engine } = makeEngine();
		const bare = engine.points[3];

		const wrapper = mountPoint(engine, bare);

		expect(wrapper.classes()).toContain('c-map-point--non-clickable');
	});

	it('exposes the bare-icon anchor as CSS custom properties', () => {
		const { engine } = makeEngine();
		const bare = engine.points[3];
		const wrapper = mountPoint(engine, bare);
		const element = wrapper.element as HTMLElement;

		expect(element.style.getPropertyValue('--anchor-x')).toBe('0.5');
		expect(element.style.getPropertyValue('--anchor-y')).toBe('0.5');
	});

	it('hides points outside the active group', async () => {
		const { engine } = makeEngine();
		const wrapper = mountPoint(engine, engine.points[2]);
		expect(isShown(wrapper)).toBe(true);

		// icon-point is in landbrug, not byggeri
		engine.selectedGroup = engine.groups[0];
		await nextTick();
		expect(isShown(wrapper)).toBe(false);

		engine.selectedGroup = engine.groups[1];
		await nextTick();
		expect(isShown(wrapper)).toBe(true);
	});

	it('hides non-clickable points while any group is active', async () => {
		const { engine } = makeEngine();
		const bare = engine.points[3];
		const wrapper = mountPoint(engine, bare);

		// bare-point is tagged landbrug but bare icons never join a group
		engine.selectedGroup = engine.groups[1];
		await nextTick();

		expect(isShown(wrapper)).toBe(false);
	});

	it('respects the point visible flag', async () => {
		const { engine } = makeEngine();
		const point = engine.points[0];
		const wrapper = mountPoint(engine, point);

		point.visible = false;
		await nextTick();

		expect(isShown(wrapper)).toBe(false);
	});

	it('rides the visibility of the layer it is tied to', async () => {
		const { engine } = makeEngine();
		const point = engine.points[0];
		const parking = engine.layers.find(
			(layer) => layer.name === 'parking'
		)!;

		// parking is a toggleable layer, off by default
		point.layer = 'parking';
		const wrapper = mountPoint(engine, point);
		await nextTick();
		expect(isShown(wrapper)).toBe(false);

		engine.toggleLayer(parking);
		await nextTick();
		expect(isShown(wrapper)).toBe(true);
	});

	it('shows an active-group member even on a hidden layer', async () => {
		const { engine } = makeEngine();
		const point = engine.points[0]; // title-point, in group 'byggeri'
		point.layer = 'floor-1'; // hidden: floor not selected, out of scale
		const wrapper = mountPoint(engine, point);
		await nextTick();
		expect(isShown(wrapper)).toBe(false);

		engine.selectedGroup = engine.groups[0]; // byggeri
		await nextTick();
		expect(isShown(wrapper)).toBe(true);
	});

	it('shows the selected point even on a hidden layer', async () => {
		const { engine } = makeEngine();
		const point = engine.points[0];
		point.layer = 'floor-1';
		const wrapper = mountPoint(engine, point);
		await nextTick();
		expect(isShown(wrapper)).toBe(false);

		point.selectedAsDestination = true;
		await nextTick();
		expect(isShown(wrapper)).toBe(true);
	});

	it('shows the selected point even under a non-member active group', async () => {
		const { engine } = makeEngine();
		const point = engine.points[0]; // in group 'byggeri', not 'landbrug'
		const wrapper = mountPoint(engine, point);

		engine.selectedGroup = engine.groups[1]; // landbrug — excludes this point
		await nextTick();
		expect(isShown(wrapper)).toBe(false);

		point.selectedAsDestination = true;
		await nextTick();
		expect(isShown(wrapper)).toBe(true);
	});

	it('shows only the endpoints once both origin and destination are set', async () => {
		const { engine } = makeEngine();
		const destination = engine.points[0];
		const origin = engine.points[1];
		const other = engine.points[2];
		const wOther = mountPoint(engine, other);
		const wDestination = mountPoint(engine, destination);
		const wOrigin = mountPoint(engine, origin);

		// With only a destination, everything else still follows normal rules
		destination.selectedAsDestination = true;
		await nextTick();
		expect(isShown(wOther)).toBe(true);

		// Adding the origin collapses the map to just the two endpoints
		origin.selectedAsOrigin = true;
		await nextTick();
		expect(isShown(wDestination)).toBe(true);
		expect(isShown(wOrigin)).toBe(true);
		expect(isShown(wOther)).toBe(false);
	});
});
