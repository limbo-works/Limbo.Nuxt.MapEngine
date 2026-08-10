<template>
	<Transition name="c-map-content-overlay">
		<aside v-if="point" ref="root" class="c-map-content-overlay">
			<div class="c-map-content-overlay__scroller">
				<h2
					class="c-map-content-overlay__title"
					v-text="point.label"
				></h2>

				<div class="c-map-content-overlay__content">
					<slot :point="point" :content="blocks">
						<div
							v-for="(block, index) in blocks"
							:key="index"
							class="c-map-content-overlay__placeholder"
						>
							<strong
								v-if="block.title"
								v-text="block.title"
							></strong>
							<span v-text="block.alias"></span>
						</div>
					</slot>
				</div>
			</div>

			<button
				type="button"
				class="c-map-content-overlay__close"
				:aria-label="closeLabel"
				@click="emit('close')"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M5 5l14 14M19 5L5 19"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</button>
		</aside>
	</Transition>
</template>

<script setup lang="ts">
import {
	computed,
	nextTick,
	onMounted,
	onBeforeUnmount,
	useTemplateRef,
	watch,
} from 'vue';
import type { IEngine, IPoint } from '../../src/runtime/types';
import type { IMapPointContent } from '../types';

const props = withDefaults(
	defineProps<{
		engine: IEngine;
		point: IPoint | null;
		closeLabel?: string;
	}>(),
	{ closeLabel: 'Luk' }
);
const emit = defineEmits<{ close: [] }>();

const root = useTemplateRef('root');

// The engine treats IPoint.content as opaque — this playground's own
// payload shape (see playground/types.ts) is what activatePoint's
// onActivatePoint handler already checked before opening this overlay
const blocks = computed(
	() => (props.point?.content as IMapPointContent | undefined)?.blocks ?? []
);

onMounted(() => {
	document.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
	document.removeEventListener('keydown', onKeyDown);
});

watch(
	() => props.point,
	async (point, previous) => {
		if (point) {
			await nextTick();
			zoomBesidePanel(point);
		} else if (previous?.selectedAsDestination) {
			props.engine.viewport.zoomTo(
				previous.position,
				props.engine.focusScale,
				{
					...props.engine.focusAnimation,
					duration: 500,
				}
			);
		}
	}
);

// Re-frames the focused point into the map strip the panel leaves visible,
// via zoomTo's origin option. Coverage is measured from the rendered panel
// so the CSS (and any consumer override of it) stays the single source of
// the panel's width; at full coverage there is no strip to center in.
function zoomBesidePanel(point: IPoint) {
	const parent = root.value?.parentElement;
	if (!root.value || !parent?.offsetWidth) {
		return;
	}

	const coverage = root.value.offsetWidth / parent.offsetWidth;
	if (coverage >= 0.9) {
		return;
	}

	props.engine.viewport.zoomTo(point.position, props.engine.focusScale, {
		...props.engine.focusAnimation,
		duration: 500,
		origin: { x: (1 - coverage) / 2, y: 0.5 },
	});
}

function onKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && props.point) {
		emit('close');
	}
}
</script>

<style>
:where(.c-map-content-overlay) {
	box-sizing: border-box;
	position: absolute;
	top: 0;
	right: 0;
	width: 65%;
	height: 100%;

	/* The engine's topmost surface — must beat any z-indexed consumer
	   chrome in the overlay slot (:where keeps this overridable) */
	z-index: 100;

	background-color: #fbfbfd;

	/* Same Figma motion-spec spring as the engine's focusAnimation easing,
	   sampled into linear(), so panel and viewport move as one */
	transition: transform var(--map-content-overlay-duration, 500ms)
		var(
			--map-content-overlay-ease,
			linear(
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
			)
		);

	&.c-map-content-overlay-enter-from,
	&.c-map-content-overlay-leave-to {
		transform: translateX(100%);
	}

	& .c-map-content-overlay__scroller {
		box-sizing: border-box;
		height: 100%;
		padding: 36px 28px;
		overflow-y: auto;

		scrollbar-width: none;

		&::-webkit-scrollbar {
			display: none;
		}
	}

	& .c-map-content-overlay__title {
		margin: 0;
		padding-bottom: 32px;

		/* Clears the fixed close button */
		padding-right: 64px;

		font-size: 35px;
		font-weight: 400;
		line-height: 1.2;
		color: #000;
	}

	& .c-map-content-overlay__close {
		position: absolute;
		top: 30px;
		right: 28px;

		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		padding: 0;
		border: none;
		border-radius: 50%;
		background-color: #1e1e1e;
		color: #f1f1f2;
		cursor: pointer;

		& svg {
			width: 32px;
			height: 32px;
		}
	}

	@media (max-width: 768px) {
		width: 100%;

		& .c-map-content-overlay__scroller {
			padding: 36px 18px;
		}

		& .c-map-content-overlay__title {
			padding-bottom: 20px;
			padding-right: 48px;
			font-size: 19px;
		}

		& .c-map-content-overlay__close {
			top: 32px;
			right: 18px;
			width: 32px;
			height: 32px;

			& svg {
				width: 24px;
				height: 24px;
			}
		}
	}
}
</style>
