<template>
	<div v-if="floors.length > 0" class="c-map-floor-switcher">
		<span class="c-map-floor-switcher__label">Etage</span>

		<div class="c-map-floor-switcher__buttons">
			<!-- .stop keeps the document click-outside listener from
				     deselecting the current point when switching floors -->
			<button
				v-for="floor in floors"
				:key="floor.id"
				:class="[
					'c-map-floor-switcher__button',
					{
						'c-map-floor-switcher__button--active':
							floor.id === activeFloor?.id,
					},
				]"
				@click.stop="$emit('select-floor', floor)"
			>
				{{ floor.label }}
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { IFloor } from '../../src/runtime/types';

defineProps<{
	floors: IFloor[];
	activeFloor: IFloor | null;
}>();

defineEmits<{ 'select-floor': [floor: IFloor] }>();
</script>

<style>
:where(.c-map-floor-switcher) {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 4px 4px 4px 20px;
	background-color: #fbfbfd;
	border-radius: 40px;

	font-family: 'PP Neue Machina';
	font-size: 15px;
	line-height: 1.2;

	box-shadow: 0px 0px 0.5px rgba(0, 0, 0, 0.25);

	& .c-map-floor-switcher__label {
		padding-top: 4px;
		color: #1e1e1e;
	}

	& .c-map-floor-switcher__buttons {
		display: flex;
		gap: 2px;
	}

	& .c-map-floor-switcher__button {
		appearance: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 4px 0 0;
		border: none;
		border-radius: 9999px;
		background-color: #dfe0e2;

		font: inherit;
		color: #000;
		cursor: pointer;

		transition: 300ms var(--ease-slow);

		&.c-map-floor-switcher__button--active {
			background-color: #1e1e1e;
			color: #fff;
		}
	}

	@media (max-width: 768px) {
		padding: 4px;

		& .c-map-floor-switcher__label {
			display: none;
		}

		& .c-map-floor-switcher__buttons {
			gap: 4px;
		}

		& .c-map-floor-switcher__button {
			width: 36px;
			height: 36px;
		}
	}
}
</style>
