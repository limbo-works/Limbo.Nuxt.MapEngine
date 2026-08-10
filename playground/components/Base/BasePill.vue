<template>
	<button
		:class="['c-base-pill', { 'c-base-pill--active': active }]"
		:style="{ '--color': color }"
	>
		<span v-text="label"></span>
		<span v-if="amount" v-text="`(${amount})`"></span>
	</button>
</template>

<script setup lang="ts">
defineProps<{
	label: string;
	color?: string;
	amount?: number;
	active?: boolean;
}>();
</script>

<style>
:where(.c-base-pill) {
	appearance: none;

	display: flex;
	align-items: center;
	gap: 6px;

	height: 40px;
	padding: 8px 22px 4px 22px;

	border: none;
	border-radius: 9999px;
	background-color: var(--white);
	color: var(--black);

	font-family: 'PP Neue Machina';
	font-size: 16.6px;
	line-height: 1.2;
	white-space: nowrap;

	box-shadow: 0px 0px 0.5px rgba(0, 0, 0, 0.25);
	cursor: pointer;

	&.c-base-pill--active {
		background-color: var(--color, var(--white));
	}

	@media (max-width: 768px) {
		height: auto;
		padding: 11px 14px 9px;
		font-size: 12.34px;
	}
}
</style>
