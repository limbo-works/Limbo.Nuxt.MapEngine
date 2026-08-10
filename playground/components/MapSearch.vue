<template>
	<div class="c-map-search" @focusout="onFocusOut">
		<div class="c-map-search__field">
			<input
				ref="destinationInput"
				v-model="destinationQuery"
				class="c-map-search__input"
				type="text"
				name="map-search-destination"
				placeholder="Find uddannelse eller lokation"
				role="combobox"
				aria-label="Find uddannelse eller lokation"
				:aria-expanded="
					showSuggestions && activeField === 'destination'
				"
				aria-controls="map-search-suggestions"
				aria-autocomplete="list"
				@input="onInput('destination')"
				@focus="onFocus('destination')"
				@keydown="onKeydown"
			/>

			<BaseIconButton
				v-if="destinationQuery.length"
				label="Ryd søgning"
				@click="clearDestination"
			>
				<IconClose />
			</BaseIconButton>

			<BaseIconButton
				v-else
				label="Søg"
				tabindex="-1"
				@click="destinationInput?.focus()"
			>
				<IconSearch />
			</BaseIconButton>
		</div>

		<div
			v-if="destination"
			:class="[
				'c-map-search__field',
				{ 'c-map-search__field--leading-icon': originIsEmpty },
			]"
		>
			<BaseIconButton
				v-if="originIsEmpty"
				tag="span"
				class="c-map-search__button--origin"
				aria-hidden="true"
			>
				<IconDirections />
			</BaseIconButton>

			<input
				ref="originInput"
				v-model="originQuery"
				class="c-map-search__input"
				type="text"
				name="map-search-origin"
				placeholder="Hvor står du nu?"
				role="combobox"
				aria-label="Hvor står du nu?"
				:aria-expanded="showSuggestions && activeField === 'origin'"
				aria-controls="map-search-suggestions"
				aria-autocomplete="list"
				@input="onInput('origin')"
				@focus="onFocus('origin')"
				@keydown="onKeydown"
			/>

			<BaseIconButton
				v-if="!originIsEmpty"
				label="Ryd startpunkt"
				@click="clearOrigin"
			>
				<IconClose />
			</BaseIconButton>
		</div>

		<div
			v-if="showSuggestions && suggestions.length"
			id="map-search-suggestions"
			class="c-map-search__suggestions"
			role="listbox"
		>
			<button
				v-for="(point, index) in suggestions"
				:key="point.label"
				:class="[
					'c-map-search__suggestion',
					{
						'c-map-search__suggestion--highlighted':
							index === highlightedIndex,
					},
				]"
				role="option"
				:aria-selected="index === highlightedIndex"
				@mousedown.prevent
				@click="selectSuggestion(point)"
				v-text="point.label"
			></button>
		</div>
	</div>
</template>

<script setup lang="ts">
import IconClose from './Icons/IconClose.vue';
import IconDirections from './Icons/IconDirections.vue';
import IconSearch from './Icons/IconSearch.vue';

import { normalizeSearchText } from '../../src/runtime/utils/search';
import type { IEngine, IPoint } from '../../src/runtime/types';

const props = defineProps<{ engine: IEngine }>();

const destinationQuery = ref('');
const originQuery = ref('');
const activeField = ref<'destination' | 'origin'>('destination');
const showSuggestions = ref(false);
const highlightedIndex = ref(-1);

const destinationInput = useTemplateRef('destinationInput');
const originInput = useTemplateRef('originInput');

const destination = computed(() =>
	props.engine.points.find((point) => point.selectedAsDestination)
);

const origin = computed(() =>
	props.engine.points.find((point) => point.selectedAsOrigin)
);

const originIsEmpty = computed(() => !originQuery.value.length);

const suggestions = computed(() => {
	const query =
		activeField.value === 'destination'
			? destinationQuery.value
			: originQuery.value;

	return props.engine.searchPoints(query);
});

// Guards the selection watchers against the engine calls made from
// onInput — without it, clearing a selection while typing would wipe
// the text the user is in the middle of writing
let syncing = false;

watch(
	destination,
	(point) => {
		if (syncing) {
			return;
		}

		destinationQuery.value = point?.label ?? '';
		if (!point) {
			originQuery.value = '';
			showSuggestions.value = false;
		}
	},
	{ flush: 'sync' }
);

watch(
	origin,
	(point) => {
		if (syncing) {
			return;
		}

		originQuery.value = point?.label ?? '';
	},
	{ flush: 'sync' }
);

function onFocus(field: 'destination' | 'origin') {
	activeField.value = field;
	highlightedIndex.value = -1;
}

function onInput(field: 'destination' | 'origin') {
	activeField.value = field;
	showSuggestions.value = true;
	highlightedIndex.value = -1;

	const query = field === 'destination' ? destinationQuery : originQuery;
	const exact = findExactMatch(query.value);

	syncing = true;
	if (field === 'destination') {
		if (exact) {
			props.engine.selectPoint(exact);
		} else if (destination.value) {
			props.engine.selectPoint(null);
			originQuery.value = '';
		}
	} else {
		if (exact) {
			props.engine.selectOriginPoint(exact);
		} else if (origin.value) {
			props.engine.selectOriginPoint(null);
		}
	}
	syncing = false;
}

function onKeydown(event: KeyboardEvent) {
	if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		if (!suggestions.value.length) {
			return;
		}

		event.preventDefault();
		showSuggestions.value = true;

		const delta = event.key === 'ArrowDown' ? 1 : -1;
		const count = suggestions.value.length;
		highlightedIndex.value =
			(highlightedIndex.value + delta + count) % count;
	} else if (event.key === 'Enter') {
		const point = suggestions.value[highlightedIndex.value];
		if (showSuggestions.value && point) {
			event.preventDefault();
			selectSuggestion(point);
		}
	} else if (event.key === 'Escape') {
		showSuggestions.value = false;
		highlightedIndex.value = -1;
	}
}

function onFocusOut(event: FocusEvent) {
	if (
		event.relatedTarget instanceof Node &&
		event.currentTarget instanceof Node &&
		event.currentTarget.contains(event.relatedTarget)
	) {
		return;
	}

	showSuggestions.value = false;
	highlightedIndex.value = -1;
}

function selectSuggestion(point: IPoint) {
	if (activeField.value === 'destination') {
		props.engine.selectPoint(point);
		destinationQuery.value = point.label;
	} else {
		props.engine.selectOriginPoint(point);
		originQuery.value = point.label;
	}

	showSuggestions.value = false;
	highlightedIndex.value = -1;
}

function clearDestination() {
	props.engine.selectPoint(null);
	destinationQuery.value = '';
	originQuery.value = '';
	showSuggestions.value = false;

	// Refocusing lets a desktop user keep typing right away, but on a
	// touch device it just pops the on-screen keyboard over a field the
	// user tapped X specifically to dismiss
	if (!hasCoarsePointer()) {
		destinationInput.value?.focus();
	}
}

function clearOrigin() {
	props.engine.selectOriginPoint(null);
	originQuery.value = '';
	showSuggestions.value = false;

	if (!hasCoarsePointer()) {
		originInput.value?.focus();
	}
}

function hasCoarsePointer(): boolean {
	return window.matchMedia('(pointer: coarse)').matches;
}

function findExactMatch(query: string): IPoint | undefined {
	const normalized = normalizeSearchText(query);
	if (!normalized) {
		return undefined;
	}

	return props.engine.points.find(
		(point) => normalizeSearchText(point.label) === normalized
	);
}
</script>

<style>
:where(.c-map-search) {
	display: flex;
	flex-direction: column;
	gap: 8px;

	box-sizing: border-box;
	width: 402px;
	padding: 10px;
	background-color: #dfe0e2;
	border: 1px solid #cac9ca;
	border-radius: 30px;

	font-family: 'PP Neue Machina';
	font-size: 16.6px;
	line-height: 1.2;

	& * {
		box-sizing: border-box;
	}

	& .c-map-search__field {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 4px 4px 4px 18px;
		background-color: #fbfbfd;
		border-radius: 9999px;

		&.c-map-search__field--leading-icon {
			gap: 8px;
			padding: 4px 18px 4px 4px;
		}
	}

	& .c-map-search__input {
		flex: 1;
		min-width: 0;
		padding: 8px 0 4px;
		border: none;
		background: transparent;
		outline: none;

		font: inherit;
		color: #1e1e1e;

		&::placeholder {
			color: #727272;
			opacity: 1;
		}
	}

	& .c-map-search__button--origin {
		background-color: var(--green);
		color: var(--black);
		cursor: default;
	}

	& .c-map-search__suggestions {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 11px 18px 9px;
	}

	& .c-map-search__suggestion {
		appearance: none;
		padding: 0;
		border: none;
		background: transparent;

		font: inherit;
		color: #1e1e1e;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;

		&:hover,
		&.c-map-search__suggestion--highlighted {
			text-decoration: underline;
		}
	}

	@media (max-width: 768px) {
		width: 100%;
		padding: 12px 10px;
		border: none;
		border-bottom: 1px solid #cac9ca;
		border-radius: 0;
		font-size: 16px;

		/* The open suggestion list takes over the full screen below the
		   fields, covering the pills and the map */
		&:has(.c-map-search__suggestions) {
			position: relative;
			z-index: 20;
			height: 100dvh;
		}

		& .c-map-search__suggestions {
			flex: 1;
			min-height: 0;
			overflow-y: auto;
		}
	}
}

.map-search-field-enter-active,
.map-search-field-leave-active {
	transition: opacity 300ms var(--ease-slow);
}

.map-search-field-enter-from,
.map-search-field-leave-to {
	opacity: 0;
}
</style>
