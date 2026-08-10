<template>
	<component
		:is="tag"
		:type="tag === 'button' ? 'button' : undefined"
		:class="['c-base-icon-button', `c-base-icon-button--size-${size}`]"
		:aria-label="label"
	>
		<slot></slot>
	</component>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		label?: string;
		size?: 'md' | 'lg';
		// 'span' for purely decorative badges (pair with aria-hidden)
		tag?: 'button' | 'span';
	}>(),
	{ label: undefined, size: 'md', tag: 'button' }
);
</script>

<style>
:where(.c-base-icon-button) {
	appearance: none;

	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;

	width: 32px;
	height: 32px;
	padding: 0;

	border: none;
	border-radius: 9999px;
	background-color: var(--black, #1e1e1e);
	color: var(--white, #fff);
	cursor: pointer;
	transition: 300ms var(--ease-slow);

	& svg {
		width: 24px;
		height: 24px;
	}

	&.c-base-icon-button--size-lg {
		width: 40px;
		height: 40px;
	}

	&:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
}
</style>
