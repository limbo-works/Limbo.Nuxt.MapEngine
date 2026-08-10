<template>
	<div
		:class="[
			'c-map-point-pin',
			{
				'c-map-point-pin--grouped': groupColor,
				'c-map-point-pin--icon': icon,
				'c-map-point-pin--bare': !point.clickable,
				'c-map-point-pin--origin-selected': point.selectedAsOrigin,
				'c-map-point-pin--selected':
					point.selectedAsDestination || previewed,
			},
		]"
		:style="{ '--group-color': groupColor }"
	>
		<template v-if="icon">
			<div class="c-map-point-pin__plate">
				<svg
					class="c-map-point-pin__custom-icon"
					v-bind="icon.attributes"
					v-html="icon.children"
				></svg>
			</div>

			<IconTail v-if="point.clickable" class="c-map-point-pin__tail" />
		</template>

		<template v-else>
			<div class="c-map-point-pin__pill">
				<span
					class="c-map-point-pin__label"
					v-text="point.label"
				></span>

				<IconOpenInNew
					v-if="showLinkIcon"
					class="c-map-point-pin__icon"
				/>
				<IconArrow
					v-else-if="showOverlayIcon"
					class="c-map-point-pin__icon"
				/>
			</div>

			<IconTail class="c-map-point-pin__tail" />
		</template>
	</div>
</template>

<script setup lang="ts">
import IconArrow from './Icons/IconArrow.vue';
import IconOpenInNew from './Icons/IconOpenInNew.vue';
import IconTail from './Icons/IconTail.vue';

import useMapSprite from '../../src/runtime/composables/useMapSprite';
import type { IEngine, IPoint } from '../../src/runtime/types';
import type { IMapPointContent } from '../types';

const props = defineProps<{
	point: IPoint;
	engine: IEngine;
	previewed?: boolean;
}>();

const content = computed(
	() => props.point.content as IMapPointContent | undefined
);

const groupColor = computed(() => {
	const group = props.engine.selectedGroup;
	return group && props.point.groups.includes(group.id)
		? group.color
		: undefined;
});

const icon = computed(() => {
	const data = content.value?.icon;
	return data ? useMapSprite({ data }) : undefined;
});

// Custom icons never carry action icons; a content overlay wins over a
// link (matching activatePoint). The icon element is always rendered for
// action points — CSS reveals it on selection so its entrance can animate.
const showLinkIcon = computed(
	() => !content.value?.blocks?.length && content.value?.link !== undefined
);

const showOverlayIcon = computed(() => !!content.value?.blocks?.length);
</script>

<style>
:where(.c-map-point-pin) {
	cursor: pointer;
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;

	transform-origin: 50% 100%;
	transition: transform 300ms var(--ease-slow);

	& .c-map-point-pin__pill {
		display: flex;
		align-items: center;
		padding: 7px 16px;
		border-radius: 30px;

		color: var(--black);
		background-color: var(--white);
		box-shadow: 0px 0px 0.5px rgba(0, 0, 0, 0.25);
		transition: 300ms var(--ease-slow);

		& .c-map-point-pin__label {
			font-family: 'PP Neue Machina';
			font-size: 12px;
			line-height: 1.2;
			padding-top: 3px;
			white-space: nowrap;
		}

		/* Action icons stay in the DOM at zero width so their reveal (and
		   the pill growing around them) can ease in — placeholder motion,
		   no Figma spec yet */
		& .c-map-point-pin__icon {
			flex-shrink: 0;
			width: 0;
			height: 16px;
			margin-left: 0;
			opacity: 0;
			transform: scale(0.4);
			transition: 300ms var(--ease-slow);
		}
	}

	& .c-map-point-pin__plate {
		display: grid;
		place-items: center;
		padding: 3px 2px;
		border-radius: 2px;

		color: var(--black);
		background-color: var(--white);
		box-shadow: 0px 0px 0.5px rgba(0, 0, 0, 0.25);
		transition: 300ms var(--ease-slow);

		& .c-map-point-pin__custom-icon {
			display: block;
			width: 20px;
			height: 20px;

			/* Custom icons are recolored to the plate's color regardless of
			   authored fills — they are expected to be monochrome */
			fill: currentColor;

			& [fill]:not([fill='none']) {
				fill: currentColor;
			}

			& [stroke]:not([stroke='none']) {
				stroke: currentColor;
			}
		}
	}

	& .c-map-point-pin__tail {
		width: 4px;
		height: 8px;
		color: var(--white);
		transition: 300ms var(--ease-slow);
	}

	&:hover {
		transform: scale(1.12);
	}

	/* Kept above --origin-selected and --selected so wayfinding and
	   destination styles win for points that are also in the active group */
	&.c-map-point-pin--grouped {
		& .c-map-point-pin__pill,
		& .c-map-point-pin__plate {
			background-color: var(--group-color);
			color: var(--black);
		}

		& .c-map-point-pin__tail {
			color: var(--group-color);
		}
	}

	/* No dedicated Figma frame for the selected origin pin exists — the
	   green is inferred from the origin search field's icon button. Kept
	   above --selected so the destination style wins if one point is both. */
	&.c-map-point-pin--origin-selected {
		transform: scale(1.12);

		& .c-map-point-pin__pill,
		& .c-map-point-pin__plate {
			background-color: var(--black);
			color: var(--white);
		}

		& .c-map-point-pin__tail {
			color: var(--black);
		}
	}

	&.c-map-point-pin--selected {
		transform: scale(1.12);

		& .c-map-point-pin__pill,
		& .c-map-point-pin__plate {
			background-color: var(--black);
			color: var(--white);
		}

		& .c-map-point-pin__pill:has(.c-map-point-pin__icon) {
			padding-right: 10px;
			padding-left: 14px;
		}

		& .c-map-point-pin__icon {
			width: 16px;
			margin-left: 8px;
			opacity: 1;
			transform: none;
		}

		& .c-map-point-pin__tail {
			color: var(--black);
		}
	}

	/* Non-clickable bare icons (custom icon, no content/link): no plate,
	   no tail, no interaction affordances. Kept last so it also strips the
	   group tint. */
	&.c-map-point-pin--bare {
		transform-origin: center;
		pointer-events: none;

		& .c-map-point-pin__plate {
			padding: 0;
			border-radius: 0;
			background-color: transparent;
			box-shadow: none;
			color: var(--black);

			& .c-map-point-pin__custom-icon {
				width: 24px;
				height: 24px;
				filter: drop-shadow(0px 0px 0.5px rgba(0, 0, 0, 0.25));
			}
		}
	}
}
</style>
