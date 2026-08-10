<template>
	<div class="c-map-overlay-blocks">
		<template v-for="(block, index) in blocks" :key="index">
			<div
				v-if="block.alias === 'image'"
				class="c-map-overlay-blocks__image"
			></div>

			<div
				v-else-if="block.alias === 'richText'"
				class="c-map-overlay-blocks__rich-text"
			>
				<h3 v-if="block.title" v-text="block.title"></h3>
				<p>{{ block.text }}</p>
			</div>

			<div v-else class="c-map-overlay-blocks__unknown">
				{{ block.alias }}
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import type { IMapContentBlock } from '../types';

// Placeholder renderer — the real overlay block components (text, image,
// video, contact persons, link list) come from the consumer package
defineProps<{ blocks: IMapContentBlock[] }>();
</script>

<style>
:where(.c-map-overlay-blocks) {
	& .c-map-overlay-blocks__image {
		aspect-ratio: 16 / 9;
		border-radius: 26px;
		background-color: #dfe0e2;
	}

	& .c-map-overlay-blocks__rich-text {
		& h3 {
			margin: 0;
			padding-top: 60px;
			font-size: 27px;
			font-weight: 400;
			line-height: 1.2;
			letter-spacing: -0.01em;
		}

		& p {
			margin: 0;
			padding-top: 17px;
			font-size: 21px;
			line-height: 1.25;
		}
	}

	& .c-map-overlay-blocks__unknown {
		padding: 20px;
		border: 1px dashed #cac9ca;
		border-radius: 10px;
	}

	@media (max-width: 768px) {
		& .c-map-overlay-blocks__image {
			border-radius: 10px;
		}

		& .c-map-overlay-blocks__rich-text {
			& h3 {
				padding-top: 40px;
				font-size: 18px;
			}

			& p {
				font-size: 14.5px;
			}
		}
	}
}
</style>
