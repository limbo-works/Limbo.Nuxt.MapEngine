<template>
	<div ref="element" class="c-map-zoom-buttons">
		<!-- .stop keeps the document click-outside listener from
		     deselecting the current point when zooming -->
		<BaseIconButton
			:disabled="zoomOutLevel === undefined"
			label="Zoom ud"
			@click.stop="zoomToLevel(zoomOutLevel)"
		>
			<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path d="M5 11.25H19V12.75H5V11.25Z" fill="currentColor" />
			</svg>
		</BaseIconButton>

		<BaseIconButton
			:disabled="zoomInLevel === undefined"
			label="Zoom ind"
			@click.stop="zoomToLevel(zoomInLevel)"
		>
			<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M11.25 5H12.75V11.25H19V12.75H12.75V19H11.25V12.75H5V11.25H11.25V5Z"
					fill="currentColor"
				/>
			</svg>
		</BaseIconButton>

		<div class="c-map-zoom-buttons__label">
			<!-- hidden sizers keep the pill at the widest label's width,
			     so the label swap doesn't resize the pill -->
			<span
				v-for="label in zoomLabels.values()"
				:key="label"
				class="c-map-zoom-buttons__label-sizer"
				aria-hidden="true"
				v-text="label"
			></span>

			<span :key="currentLabel" v-text="currentLabel"></span>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { IEngine } from '../../src/runtime/types';

const props = defineProps<{ engine: IEngine; currentScale: number }>();

const zoomLevels = [1, 4, 16];
const epsilon = 0.5;

const zoomLabels = new Map<number, string>([
	[1, 'Områdeoversigt'],
	[4, 'Bygningsoverblik'],
	[16, 'Bygningsdetaljer'],
]);

// The label reflects the zone the scale is in (last level at or below it),
// mirroring how layers appear at their minScale thresholds.
const currentLabel = computed(() => {
	const level =
		zoomLevels.findLast((level) => level <= props.currentScale + 0.001) ??
		zoomLevels[0];

	return zoomLabels.get(level) ?? '';
});

const zoomInLevel = computed(() =>
	zoomLevels.find((level) => level > props.currentScale + epsilon)
);

const zoomOutLevel = computed(() =>
	zoomLevels.findLast((level) => level < props.currentScale - epsilon)
);

const element = useTemplateRef('element');

// Zooming around the current screen center (rather than zoomBy) guarantees
// the viewport lands exactly on the discrete level, even when a previous
// zoom animation is still in flight.
function zoomToLevel(level?: number) {
	if (level === undefined) {
		return;
	}

	const map = element.value?.closest('.c-map-engine');
	if (!map) {
		return;
	}

	const center = props.engine.viewport.screenToWorld({
		x: map.clientWidth / 2,
		y: map.clientHeight / 2,
	});

	props.engine.viewport.zoomTo(center, level, props.engine.focusAnimation);
}

function onKeydown(event: KeyboardEvent) {
	if (
		event.target instanceof Element &&
		event.target.closest('input, textarea, select, [contenteditable]')
	) {
		return;
	}

	if (event.key === '+' || event.key === '=') {
		zoomToLevel(zoomInLevel.value);
	} else if (event.key === '-' || event.key === '−') {
		zoomToLevel(zoomOutLevel.value);
	}
}

onMounted(() => {
	document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
	document.removeEventListener('keydown', onKeydown);
});
</script>

<style>
:where(.c-map-zoom-buttons) {
	display: flex;
	align-items: center;
	gap: 4px;

	padding: 4px;
	background-color: #fbfbfd;
	border-radius: 40px;

	font-family: 'PP Neue Machina';
	font-size: 15px;
	line-height: 1.2;
	box-shadow: 0px 0px 0.5px rgba(0, 0, 0, 0.25);

	& .c-map-zoom-buttons__label {
		display: grid;
		padding-top: 4px;
		padding-left: 12px;
		padding-right: 20px;
		white-space: nowrap;

		& > span {
			grid-area: 1 / 1;
		}

		& .c-map-zoom-buttons__label-sizer {
			visibility: hidden;
		}
	}

	@media (max-width: 768px) {
		gap: 18px;

		& .c-base-icon-button {
			width: 36px;
			height: 36px;
		}

		& .c-map-zoom-buttons__label {
			display: none;
		}
	}
}
</style>
