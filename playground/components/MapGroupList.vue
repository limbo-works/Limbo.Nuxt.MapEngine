<template>
	<Transition name="t-map-group-list">
		<div
			v-if="engine.selectedGroup"
			ref="element"
			:class="[
				'c-map-group-list',
				{ 'c-map-group-list--collapsed': collapsed },
			]"
			:style="{ '--collapsed-peek': `${peek}px` }"
			@pointerdown="onPointerDown"
		>
			<span
				class="c-map-group-list__drag-indicator"
				aria-hidden="true"
			></span>

			<!-- .stop keeps the document click-outside listener from
		     deselecting the current point when using the list -->
			<div
				v-if="!collapsed || isMobile"
				class="c-map-group-list__scroller"
			>
				<button
					v-for="(point, index) in points"
					:key="index"
					class="c-map-group-list__item"
					@click.stop="onItemClick(point)"
					@mouseenter="emit('preview', point)"
					@mouseleave="emit('preview', null)"
					v-text="point.label"
				></button>
			</div>

			<div
				v-else
				ref="bar"
				class="c-map-group-list__bar"
				@click.stop="onBarClick"
			>
				<span
					class="c-map-group-list__label"
					v-text="collapsedLabel"
				></span>

				<BaseIconButton
					label="Vis liste"
					@click.stop="collapsed = false"
				>
					<IconExpand />
				</BaseIconButton>
			</div>
		</div>
	</Transition>
</template>

<script setup lang="ts">
import IconExpand from './Icons/IconExpand.vue';

import type { IEngine, IGroup, IPoint } from '../../src/runtime/types';

const props = defineProps<{ engine: IEngine }>();
const emit = defineEmits<{ preview: [point: IPoint | null] }>();

const collapsed = ref(false);
const dragging = ref(false);
const settling = ref(false);
const isMobile = ref(false);
const peek = ref(85);

const element = useTemplateRef('element');
const bar = useTemplateRef('bar');

const points = computed(() =>
	props.engine.selectedGroup
		? props.engine.getGroupPoints(props.engine.selectedGroup)
		: []
);

const collapsedLabel = computed(
	() =>
		props.engine.points.find((point) => point.selectedAsDestination)
			?.label ??
		props.engine.selectedGroup?.label ??
		''
);

let mediaQuery: MediaQueryList | undefined;
let resizeObserver: ResizeObserver | undefined;
let settleTimeout: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
	mediaQuery = window.matchMedia('(max-width: 768px)');
	isMobile.value = mediaQuery.matches;
	mediaQuery.addEventListener('change', onMediaChange);

	resizeObserver = new ResizeObserver(updatePeek);
});

onBeforeUnmount(() => {
	mediaQuery?.removeEventListener('change', onMediaChange);
	resizeObserver?.disconnect();
	clearTimeout(settleTimeout);
	document.documentElement.style.removeProperty('--map-sheet-peek');
});

watch(
	() => props.engine.selectedGroup,
	async (group) => {
		collapsed.value = isMobile.value;
		emit('preview', null);

		// Desktop only — on mobile this list is a bottom sheet, not a
		// left-side panel, so it doesn't occlude the viewport horizontally
		if (!group || isMobile.value) {
			return;
		}

		// selectGroup's own fitToPoints call (centered, unpadded) has
		// already started by this point — awaiting nextTick lets the panel
		// actually mount so its rendered width can be measured, then this
		// re-fit redirects the still-running animation toward the corrected
		// target. Same two-step pattern as MapContentOverlay's
		// zoomBesidePanel, just with fitToPoints' padding instead of
		// zoomTo's origin, since multiple points have no single focus point.
		await nextTick();
		fitBesidePanel(group);
	}
);

// The bar only exists while collapsed, so the peek height is measured
// whenever it (re)mounts and kept for the drag math while it's gone
watch(bar, (el, previous) => {
	if (previous) {
		resizeObserver?.unobserve(previous);
	}

	if (el) {
		resizeObserver?.observe(el);
		updatePeek();
	}
});

// Keeps the list mounted while the sheet animates down, so the peek
// doesn't show an empty sheet mid-collapse
watch(collapsed, (value) => {
	if (!isMobile.value || !value || !element.value) {
		return;
	}

	settling.value = true;
	clearTimeout(settleTimeout);

	const el = element.value;
	const done = () => {
		settling.value = false;
		el.removeEventListener('transitionend', onTransitionEnd);
	};

	const onTransitionEnd = (event: TransitionEvent) => {
		if (event.propertyName === 'transform') {
			done();
		}
	};

	el.addEventListener('transitionend', onTransitionEnd);
	settleTimeout = setTimeout(done, 700);
});

watchEffect(() => {
	if (typeof document === 'undefined') {
		return;
	}

	const visible = isMobile.value && !!props.engine.selectedGroup;
	document.documentElement.style.setProperty(
		'--map-sheet-peek',
		visible ? `${peek.value}px` : '0px'
	);
});

function onMediaChange(event: MediaQueryListEvent) {
	isMobile.value = event.matches;
}

function updatePeek() {
	if (!element.value || !bar.value) {
		return;
	}

	peek.value =
		bar.value.getBoundingClientRect().bottom -
		element.value.getBoundingClientRect().top;
}

function onBarClick() {
	if (!isMobile.value) {
		return;
	}

	collapsed.value = false;
}

// How much of the viewport's left edge this panel covers, measured against
// the nearest .c-map-engine ancestor rather than the panel's own offset
// parent — both .c-map-viewport and this overlay slot fill that element
// exactly, so its left edge is the same coordinate space fitToPoints'
// padding expects.
function fitBesidePanel(group: IGroup) {
	const engineRoot = element.value?.closest('.c-map-engine');
	if (!element.value || !engineRoot) {
		return;
	}

	const left = Math.max(
		element.value.getBoundingClientRect().right -
			engineRoot.getBoundingClientRect().left,
		0
	);

	props.engine.viewport.fitToPoints(
		props.engine.getGroupPoints(group).map((point) => point.position),
		{
			...props.engine.focusAnimation,
			maxScale: props.engine.focusScale,
			padding: { top: 200, right: 200, bottom: 200, left: left + 200 },
		}
	);
}

let drag: {
	pointerId: number;
	startY: number;
	startTranslate: number;
	maxTranslate: number;
	lastY: number;
	lastTime: number;
	velocity: number;
	moved: boolean;
} | null = null;

function onPointerDown(event: PointerEvent) {
	if (!isMobile.value || !element.value) {
		return;
	}

	if (
		!collapsed.value &&
		event.target instanceof Element &&
		event.target.closest('.c-map-group-list__scroller')
	) {
		return;
	}

	const maxTranslate = Math.max(element.value.offsetHeight - peek.value, 0);

	drag = {
		pointerId: event.pointerId,
		startY: event.clientY,
		startTranslate: collapsed.value ? maxTranslate : 0,
		maxTranslate,
		lastY: event.clientY,
		lastTime: event.timeStamp,
		velocity: 0,
		moved: false,
	};

	try {
		element.value.setPointerCapture(event.pointerId);
	} catch {
		// synthetic pointer events have no active pointer to capture
	}
	element.value.addEventListener('pointermove', onPointerMove);
	element.value.addEventListener('pointerup', onPointerUp);
	element.value.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(event: PointerEvent) {
	if (!drag || !element.value || event.pointerId !== drag.pointerId) {
		return;
	}

	const delta = event.clientY - drag.startY;
	if (!drag.moved && Math.abs(delta) < 4) {
		return;
	}

	drag.moved = true;
	dragging.value = true;

	const elapsed = event.timeStamp - drag.lastTime;
	if (elapsed > 0) {
		drag.velocity = (event.clientY - drag.lastY) / elapsed;
	}
	drag.lastY = event.clientY;
	drag.lastTime = event.timeStamp;

	const translate = Math.min(
		Math.max(drag.startTranslate + delta, 0),
		drag.maxTranslate
	);

	element.value.style.transition = 'none';
	element.value.style.transform = `translateY(${translate}px)`;
}

function onPointerUp(event: PointerEvent) {
	if (!drag || !element.value || event.pointerId !== drag.pointerId) {
		return;
	}

	const { moved, velocity, startTranslate, maxTranslate } = drag;
	const delta = drag.lastY - drag.startY;
	const translate = Math.min(
		Math.max(startTranslate + delta, 0),
		maxTranslate
	);

	element.value.removeEventListener('pointermove', onPointerMove);
	element.value.removeEventListener('pointerup', onPointerUp);
	element.value.removeEventListener('pointercancel', onPointerUp);
	drag = null;

	if (!moved) {
		dragging.value = false;
		return;
	}

	// The click fired after a drag would bubble to the document
	// click-outside listener (or hit the bar/list) — swallow it once
	window.addEventListener('click', stopClickOnce, {
		capture: true,
		once: true,
	});
	setTimeout(() => {
		window.removeEventListener('click', stopClickOnce, {
			capture: true,
		});
	}, 100);

	if (Math.abs(velocity) > 0.4) {
		collapsed.value = velocity > 0;
	} else {
		collapsed.value = translate > maxTranslate / 2;
	}

	dragging.value = false;
	element.value.style.transition = '';
	element.value.style.transform = '';
}

function stopClickOnce(event: MouseEvent) {
	event.stopPropagation();
}

// Collapsing unmounts the hovered item, so its mouseleave never fires —
// clear the preview explicitly
function onItemClick(point: IPoint) {
	emit('preview', null);
	props.engine.selectPoint(point);
	collapsed.value = true;
}
</script>

<style>
:where(.c-map-group-list) {
	display: flex;
	flex-direction: column;

	box-sizing: border-box;
	width: 402px;
	background-color: #dfe0e2;
	border: 1px solid #cac9ca;
	border-radius: 30px;
	overflow: hidden;

	font-family: 'PP Neue Machina';
	font-size: 16.6px;
	line-height: 1.2;

	& * {
		box-sizing: border-box;
	}

	&:not(.c-map-group-list--collapsed) {
		flex: 1;
		min-height: 0;
	}

	&.c-map-group-list--collapsed {
		flex: none;
	}

	& .c-map-group-list__drag-indicator {
		display: none;
	}

	& .c-map-group-list__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 12px 12px 28px;
	}

	& .c-map-group-list__scroller {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 27px 26px;
		overflow-y: auto;

		/* scrollbar-width: thin; */

		&::-webkit-scrollbar {
			width: 19px;
		}

		&::-webkit-scrollbar-track {
			background-color: #dfe0e2;
			border-radius: 10px;
		}

		&::-webkit-scrollbar-thumb {
			background-color: rgba(30, 30, 30, 0.1);
			border: 8px solid #dfe0e2;
			border-top-width: 32px;
			border-bottom-width: 32px;
			border-radius: 10px;
		}
	}

	& .c-map-group-list__item {
		flex-shrink: 0;
		appearance: none;
		padding: 0;
		border: none;
		background: transparent;

		font: inherit;
		color: #1e1e1e;
		opacity: 0.7;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
		cursor: pointer;

		&:hover {
			opacity: 1;
		}
	}

	& .c-map-group-list__label {
		padding-top: 4px;
		color: #1e1e1e;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 768px) {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		width: auto;
		height: calc(100dvh - 119px);
		border-bottom: none;
		border-radius: 30px 30px 0 0;

		font-size: 12.34px;
		touch-action: none;
		transition: transform 300ms var(--ease-slow);

		/* &:not(.c-map-group-list--collapsed) { */
		flex: none;
		/* } */

		&.c-map-group-list--collapsed {
			transform: translateY(calc(100% - var(--collapsed-peek, 85px)));
		}

		& .c-map-group-list__drag-indicator {
			display: block;
			flex-shrink: 0;
			align-self: center;
			width: 80px;
			height: 3px;
			margin-top: 18px;
			border-radius: 10px;
			background-color: #1e1e1e;
			opacity: 0.1;
		}

		& .c-map-group-list__scroller {
			flex: 1;
			min-height: 0;
			padding: 24px 38px 40px 28px;
			touch-action: pan-y;
		}

		&.t-map-group-list-enter-active,
		&.t-map-group-list-leave-active {
			transition: 300ms var(--ease-slow);
		}

		&.t-map-group-list-enter-from,
		&.t-map-group-list-leave-to {
			transform: translateY(100%);
		}
	}
}
</style>
