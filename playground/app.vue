<template>
	<div id="app">
		<MapEngine :engine="engine">
			<template #point="{ point }">
				<MapPointPin
					:point="point"
					:engine="engine"
					:previewed="point === previewedPoint"
				/>
			</template>

			<template #overlay>
				<div class="c-map-overlay">
					<div class="c-map-row">
						<div class="c-map-overlay__column">
							<MapSearch :engine="engine" />

							<MapGroupList
								:engine="engine"
								@preview="
									(point: IPoint | null) =>
										(previewedPoint = point)
								"
							/>
						</div>

						<MapFilterPills :engine="engine" />
					</div>
				</div>

				<div class="c-map-controls">
					<MapZoomButtons
						:engine="engine"
						:current-scale="engine.viewport.scale"
					/>

					<MapFloorSwitcher
						:floors="engine.getAvailableFloors()"
						:active-floor="engine.selectedFloor"
						@select-floor="
							(floor: IFloor) => engine.selectFloor(floor)
						"
					/>
				</div>

				<MapContentOverlay
					:engine="engine"
					:point="openPoint"
					@close="openPoint = null"
				>
					<template #default="{ content }">
						<MapOverlayBlocks :blocks="content" />
					</template>
				</MapContentOverlay>
			</template>
		</MapEngine>
	</div>
</template>

<script setup lang="ts">
import type { IFloor, ILayerOptions, IPoint } from '../src/runtime/types';
import type { IMapPointContent } from './types';

/**
 * GLOB ALL SPRITES
 * (Vite statically parses these calls, so the options object has to be an
 * inline literal in every call rather than a shared const)
 */
const baseSprites = import.meta.glob<string>(
	'./assets/map/layers/required/*.svg',
	{ query: '?raw', import: 'default' }
);
const floorSprites = import.meta.glob<string>(
	'./assets/map/layers/required/floors/*.svg',
	{ query: '?raw', import: 'default' }
);
const optionalSprites = import.meta.glob<string>(
	'./assets/map/layers/optional/*.svg',
	{ query: '?raw', import: 'default' }
);
const hiddenSprites = import.meta.glob<string>(
	'./assets/map/layers/hidden/*.svg',
	{ query: '?raw', import: 'default' }
);
const buildingSprites = import.meta.glob<string>(
	'./assets/map/buildings/*.svg',
	{ query: '?raw', import: 'default' }
);

/**
 * SETTINGS
 */
const spriteScaleFactors = new Map<string, number>([
	['0-base', 0.05],
	['1-entrances-inactive', 0.1],
	['0-roads', 0.7],
	['0-routes', 0.9],
	['1-parking', 0.9],
	['2-parking-active', 0.9],
	['1-labels', 0.7],
	['3-entrances', 0.1],
]);

const spriteKinds = new Map<string, 'walking-routes'>([
	['0-routes', 'walking-routes'],
]);

// Layer toggle metadata (label + pill color) — only layers listed here
// become toggleable filter pills.
const spriteToggles = new Map<string, { label: string; color: string }>([
	['0-routes', { label: 'Gåruter', color: '#38C262' }],
	['2-parking-active', { label: 'Parkering', color: '#08AFE6' }],
	['3-entrances', { label: 'Indgange', color: '#F47A49' }],
]);

/**
 * SETUP
 */
const openPoint = ref<IPoint | null>(null);

const engine = useMapEngine({
	// The engine only knows a clickable point was activated a second time —
	// what that means (open an overlay, follow a link) is entirely this
	// site's own content shape (see playground/types.ts)
	onActivatePoint(point) {
		const content = point.content as IMapPointContent | undefined;

		if (content?.blocks?.length) {
			openPoint.value = point;
		} else if (content?.link) {
			window.open(content.link.url, content.link.target ?? '_self');
		}
	},
});

// Loads every globbed SVG into a layer named after its file, letting each
// group of sprites layer its own options (including a name override) on top
async function loadLayers(
	sprites: Record<string, () => Promise<string>>,
	options: (name: string) => Partial<Omit<ILayerOptions, 'sprite'>>
) {
	for (const path in sprites) {
		const name =
			path
				.split('/')
				.at(-1)
				?.replace(/\.svg$/, '') ?? 'unknown';
		const sprite = await sprites[path]();

		engine.layers.push(useMapLayer({ name, sprite, ...options(name) }));
	}
}

await loadLayers(baseSprites, (name) => ({
	scaleFactor: spriteScaleFactors.get(name) ?? 1,
}));

const floorLabels = new Map<string, string>([['0', 'st']]);

// Explicitly authored — display order in the floor switcher follows this
// array's order, not the (alphabetically globbed) sprite file order
for (const id of ['0', '1', '2', '3']) {
	engine.floors.push(useMapFloor({ id, label: floorLabels.get(id) ?? id }));
}

await loadLayers(floorSprites, (name) => ({
	minScale: 5.25,
	scaleFactor: 1.75,
	floor: name.match(/floor-(\d+)/)?.[1],
}));

engine.selectFloor(engine.floors[0]);

await loadLayers(optionalSprites, (name) => ({
	kind: spriteKinds.get(name),
	label: spriteToggles.get(name)?.label,
	color: spriteToggles.get(name)?.color,
	scaleFactor: spriteScaleFactors.get(name) ?? 1,
}));

await loadLayers(buildingSprites, (name) => ({
	// Named after the building they highlight, to match IPoint.buildings
	name: name.replace(/^building-highlight-/, '').toLowerCase(),
	kind: 'building-highlight',
	scaleFactor: 0.1,
}));

await loadLayers(hiddenSprites, (name) => ({
	scaleFactor: spriteScaleFactors.get(name) ?? 1,
}));

const groupByggeri = useMapGroup({
	id: 'byggeri',
	label: 'Byggeri',
	color: '#c0935f',
});

// Only Byggeri's brown is visible in the Figma frames — this green is a
// placeholder, not a sampled value
const groupLandbrug = useMapGroup({
	id: 'landbrug',
	label: 'Landbrug',
	color: '#8faf5f',
});

engine.groups.push(groupByggeri);
engine.groups.push(groupLandbrug);

const outdoorTheme = useMapPoint({
	id: 'outdoor-theme',
	label: 'Udendørs tema',
	tags: ['Grønne områder', 'Have og anlæg'],
	groups: ['landbrug'],
	buildings: ['8', '9', '10'],
	x: 13550,
	y: 15308,
});

const sustainableBuilding = useMapPoint({
	id: 'sustainable-building',
	label: 'Bæredygtigt byggeri',
	tags: ['Tømrer', 'Snedker', 'Træ'],
	groups: ['byggeri'],
	// Arbitrary demo association — no real POI-to-building mapping has been
	// authored yet, this just exercises the building-highlight layers
	buildings: ['11+12'],
	x: 14311,
	y: 13682,
	content: {
		blocks: [
			{ alias: 'image' },
			{
				alias: 'richText',
				title: '21c-21d',
				text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque a facilisis massa. In hac habitasse platea dictumst. Curabitur venenatis risus quis dolor dapibus, eget aliquam eros vestibulum. Etiam interdum lacus viverra eros ornare, sed congue metus rutrum. In lectus nisi, varius non lectus sit amet, scelerisque sagittis eros. Pellentesque finibus ut nunc at sodales. Cras elementum tristique auctor. Sed egestas ligula non augue condimentum, vitae bibendum turpis facilisis. Cras ornare aliquet eleifend. Aenean laoreet ultrices gravida. Phasellus efficitur neque et augue dictum consequat. Nunc ullamcorper ut felis et varius. Maecenas commodo cursus leo at tincidunt. Nullam sit amet euismod velit. Praesent vel convallis tortor.',
			},
		],
	} satisfies IMapPointContent,
});

const eventParticipant = useMapPoint({
	id: 'event-participant',
	label: 'Eventdeltager',
	tags: ['Event', 'Gæst'],
	groups: ['byggeri'],
	buildings: ['6'],
	x: 15189,
	y: 15153,
	content: {
		link: { url: 'https://example.com', target: '_blank' },
	} satisfies IMapPointContent,
});

const testPoint = useMapPoint({
	id: 'test',
	label: 'Test',
	tags: ['Prøve'],
	groups: ['byggeri', 'landbrug'],
	buildings: ['1a'],
	x: 19800,
	y: 14800,
});

// Custom-icon demo points — the authored fills and differing viewBox sizes
// are deliberate: the pin recolors to currentColor and renders both at the
// same fixed size regardless of the source SVG
const icon =
	'<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5684 6.99902C13.0073 7.19996 13.4153 7.45625 13.7832 7.75977C12.5635 8.76789 11.7842 10.2924 11.7842 12C11.7842 13.7073 12.564 15.2304 13.7832 16.2383C12.8318 17.0255 11.6145 17.5 10.2842 17.5C8.95362 17.5 7.73567 17.0257 6.78418 16.2383C8.00374 15.2304 8.78418 13.7076 8.78418 12C8.78418 10.2919 8.00454 8.7669 6.78418 7.75879C7.1509 7.45571 7.55789 7.20053 7.99512 7C8.69258 7.3199 9.46761 7.5 10.2842 7.5C11.0998 7.5 11.8723 7.31787 12.5684 6.99902Z" stroke="black"/><path d="M13.3477 1.38037C13.7369 2.29513 13.7245 3.36835 13.2197 4.31104C12.7147 5.25399 11.8278 5.85946 10.8506 6.04248C10.4624 5.12816 10.4758 4.05414 10.9805 3.11182C11.485 2.16985 12.3714 1.56393 13.3477 1.38037Z" stroke="black"/><path d="M10.5 7V6.5C10.5 4.87722 9.97367 3.29822 9 2" stroke="black"/></svg>';

const coffeeBar = useMapPoint({
	id: 'coffee-bar',
	label: 'Kaffebar',
	tags: ['Kaffe', 'Pause'],
	groups: ['landbrug'],
	buildings: ['40'],
	x: 15080,
	y: 9750,
	content: {
		icon,
		blocks: [
			{ alias: 'image' },

			{
				alias: 'richText',
				title: 'Kaffebar',
				text: 'Placeholder for kaffebarens indhold.',
			},
		],
	} satisfies IMapPointContent,
});

engine.points.push(
	outdoorTheme,
	sustainableBuilding,
	eventParticipant,
	testPoint,
	coffeeBar
);

useMapUrlSync(engine);

const previewedPoint = ref<IPoint | null>(null);
</script>

<style>
@font-face {
	font-family: 'PP Neue Machina';
	src: url('~/assets/fonts/PPNeueMachina-InktrapRegular.otf')
		format('opentype');
	font-weight: 400;
	font-style: normal;
	font-display: swap;
}

html,
body {
	overscroll-behavior: none;
}

:where(#app .c-map-engine) {
	position: fixed;
	top: 0%;
	left: 0%;
	width: 100vw;
	/* 100vh on iOS Safari is the large viewport — its bottom strip hides
	   behind the collapsible toolbar, taking the bottom controls with it */
	height: 100vh;
	height: 100dvh;

	cursor: grab;

	&:active {
		cursor: grabbing;
	}
}

/* Not :where-wrapped — pointer-events must beat the auto set on overlay
   children by MapEngine.vue, so the empty parts of this full-size wrapper
   don't block map pans */
#app .c-map-overlay {
	position: absolute;
	top: 20px;
	left: 20px;
	right: 20px;
	bottom: 72px;
	display: flex;
	align-items: flex-start;
	pointer-events: none;
	gap: 8px;

	& .c-map-overlay__column {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		pointer-events: none;
	}

	& .c-map-row {
		width: 100%;
		max-height: 100%;
		display: flex;
		row-gap: 8px;

		& .c-map-filter-pills {
			padding: 11px 0px;
			flex: 1;
			min-width: 0;
			height: fit-content;
			pointer-events: none;

			& > * {
				pointer-events: initial;
			}
		}
	}

	& .c-map-search,
	& .c-map-group-list,
	& .c-map-filter-pills {
		pointer-events: auto;
	}

	@media (max-width: 768px) {
		top: 0;
		left: 0;
		right: 0;

		& .c-map-row {
			flex-direction: column;
		}

		& .c-map-overlay__column {
			align-items: stretch;
			width: 100%;
		}

		& .c-map-row .c-map-filter-pills {
			flex: none;
			padding: 0 8px;
			margin: 0 -16px;
		}
	}
}

#app .c-map-content-overlay {
	font-family: 'PP Neue Machina';
}

:where(#app .c-map-controls) {
	position: absolute;
	bottom: 20px;
	left: 20px;
	display: flex;
	align-items: center;
	gap: 8px;

	@media (max-width: 768px) {
		right: 20px;
		bottom: calc(20px + var(--map-sheet-peek, 0px));
		justify-content: space-between;
		transition: bottom 300ms var(--ease-slow);
	}
}

:where(#app .app-overlay) {
	position: fixed;
	top: 32px;
	left: 32px;
	z-index: 10;
	display: flex;
	column-gap: 8px;

	& button {
		appearance: none;
		background-color: #fff;
		border: none;

		font-size: 14px;
		padding: 8px 16px !important;
		padding-top: 12px !important;

		font-family: 'PP Neue Machina';
		text-transform: uppercase;
		border-radius: 9999px;
		cursor: pointer;

		&:active {
			background-color: #fafafa;
		}
	}
}

:root {
	--white: #fbfbfb;
	--black: #1e1e1e;
	--green: #38c262;

	/* Spring from the Figma motion spec, sampled into linear():
	   1 - e^(-11.18t) * (cos(0.158t) + 70.71 * sin(0.158t)) */
	--ease-slow: linear(
		0,
		0.108 5%,
		0.308 10%,
		0.5 15%,
		0.654 20%,
		0.768 25%,
		0.848 30%,
		0.902 35%,
		0.937 40%,
		0.961 45%,
		0.975 50%,
		0.991 60%,
		0.997 70%,
		1
	);

	--ease-bounce: linear(
		0,
		0.03,
		0.1077,
		0.2165,
		0.342,
		0.4728,
		0.6001,
		0.7175,
		0.8208,
		0.9077,
		0.9776,
		1.0307,
		1.0684,
		1.0925,
		1.1051,
		1.1084,
		1.1047,
		1.096,
		1.084,
		1.0703,
		1.0561,
		1.0424,
		1.0297,
		1.0187,
		1.0094,
		1.0019,
		0.9963,
		0.9923,
		0.9898,
		0.9885,
		0.9882,
		0.9887,
		0.9897,
		0.991,
		0.9925,
		0.994,
		0.9955,
		0.9969,
		0.9981,
		0.9991,
		0.9998,
		1.0004,
		1.0009,
		1.0011,
		1.0012,
		1.0013,
		1.0012,
		1.0011,
		1.001,
		1.0008,
		1.0006
	);
}
</style>
