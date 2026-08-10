<template>
	<div
		:class="[
			'c-map-filter-pills',
			{
				'c-map-filter-pills--show-buttons': showButtons,
				'c-map-filter-pills--can-scroll-left': canScrollLeft,
				'c-map-filter-pills--can-scroll-right': canScrollRight,
			},
		]"
	>
		<div ref="viewport" class="c-map-filter-pills__items">
			<BasePill
				v-for="item in layers"
				:key="item.name"
				:label="item.label"
				:color="item.color"
				:active="item.visible"
				@click.stop="engine.toggleLayer(item)"
			/>

			<BasePill
				v-for="item in groups"
				:key="item.id"
				:label="item.label"
				:color="item.color"
				:active="item.id === engine.selectedGroup?.id"
				:amount="engine.getGroupPoints(item).length"
				@click.stop="engine.toggleGroup(item)"
			/>
		</div>

		<div class="c-map-filter-pills__controls">
			<BaseIconButton
				size="lg"
				class="c-map-filter-pills__controls-previous"
				label="Vis forrige"
				@click="scrollByPage(-1)"
			>
				<IconArrow />
			</BaseIconButton>

			<BaseIconButton
				size="lg"
				class="c-map-filter-pills__controls-next"
				label="Vis flere"
				@click="scrollByPage(1)"
			>
				<IconArrow />
			</BaseIconButton>
		</div>
	</div>
</template>

<script setup lang="ts">
import IconArrow from './Icons/IconArrow.vue';

import type {
	IEngine,
	IGroup,
	IToggleableLayer,
} from '../../src/runtime/types';

const props = defineProps<{ engine: IEngine }>();

const showButtons = ref(false);
const canScrollLeft = ref(false);
const canScrollRight = ref(true);

const layers = computed<IToggleableLayer[]>(() =>
	props.engine.getToggleableLayers()
);
const groups = computed<IGroup[]>(() => props.engine.groups);

const viewport = useTemplateRef('viewport');
let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
	updateScrollState();

	viewport.value?.addEventListener('scroll', updateScrollState);
	resizeObserver = new ResizeObserver(updateScrollState);
	if (viewport.value) resizeObserver.observe(viewport.value);
});

onBeforeUnmount(() => {
	resizeObserver?.disconnect();
});

function updateScrollState() {
	const el = viewport.value;
	if (!el) return;

	const overflowing = el.scrollWidth > el.clientWidth + 1;
	showButtons.value = overflowing;
	canScrollLeft.value = overflowing && el.scrollLeft > 0;
	canScrollRight.value =
		overflowing && el.scrollLeft + el.clientWidth < el.scrollWidth - 1;

	// Mask strength tracks actual scroll position rather than snapping on
	// the can-scroll boundary — 1 (opaque, no fade) right at an edge,
	// ramping to 0 (transparent, fade fully shown) once scrolled a full
	// --fade-distance away from it, so the fade grows with the gesture
	// instead of a fixed-duration transition on a binary state
	const fadeDistance = 16;
	const remainingRight = el.scrollWidth - el.clientWidth - el.scrollLeft;

	const strengthLeft = overflowing
		? clamp(1 - el.scrollLeft / fadeDistance, 0, 1)
		: 1;
	const strengthRight = overflowing
		? clamp(1 - remainingRight / fadeDistance, 0, 1)
		: 1;

	el.style.setProperty('--fade-strength-left', `${strengthLeft}`);
	el.style.setProperty('--fade-strength-right', `${strengthRight}`);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function scrollByPage(direction: 1 | -1) {
	const el = viewport.value;
	if (!el) return;

	el.scrollBy({
		left: direction * el.clientWidth * 0.8,
		behavior: 'smooth',
	});
}

watch(
	() => [layers.value.length, groups.value.length],
	() => nextTick(updateScrollState)
);
</script>

<style>
:where(.c-map-filter-pills) {
	--fade-distance: 128px;
	--fade-strength-left: 1;
	--fade-strength-right: 1;

	display: flex;
	gap: 0px;

	& .c-map-filter-pills__items {
		flex: 1;
		overflow-y: scroll;
		display: flex;
		gap: 8px;
		padding: 0px 16px;

		mask-image: linear-gradient(
			to right,
			rgb(0 0 0 / var(--fade-strength-left)) 0%,
			#000 var(--fade-distance),
			#000 calc(100% - var(--fade-distance)),
			rgb(0 0 0 / var(--fade-strength-right)) 100%
		);

		&::-webkit-scrollbar {
			display: none;
		}
	}

	& .c-map-filter-pills__controls {
		display: none;
		gap: 4px;

		& .c-map-filter-pills__controls-next,
		& .c-map-filter-pills__controls-previous {
			pointer-events: auto;
			filter: brightness(5);
		}

		& .c-map-filter-pills__controls-previous {
			transform: rotate(180deg);
		}
	}

	&.c-map-filter-pills--show-buttons .c-map-filter-pills__controls {
		display: flex;
	}

	&.c-map-filter-pills--can-scroll-left {
		& .c-map-filter-pills__controls-previous {
			filter: brightness(1);
		}
	}

	&.c-map-filter-pills--can-scroll-right {
		& .c-map-filter-pills__controls-next {
			filter: brightness(1);
		}
	}

	@media (max-width: 768px) {
		--fade-distance: 48px;

		& .c-map-filter-pills__items {
			gap: 4px;
		}

		&.c-map-filter-pills--show-buttons .c-map-filter-pills__controls {
			display: none;
		}
	}
}
</style>
