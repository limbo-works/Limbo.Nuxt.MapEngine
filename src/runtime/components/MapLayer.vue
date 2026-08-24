<template>
	<Transition :css="false" @enter="onEnter" @leave="onLeave">
		<div
			v-if="isVisible"
			ref="root"
			class="c-map-layer-transition"
			:data-layer-name="layer.name"
			:data-layer-kind="layer.kind"
			:style="{
				'--scale-factor': layer.sprite.scaleFactor,
				'--scale-origin': layer.sprite.scaleOrigin,
				'--counter-scale-from': layer.sprite.counterScaleFrom,
			}"
		></div>
	</Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, useTemplateRef, watch } from 'vue';
import type { ILayer, IEngine } from '../types';

const props = defineProps<{ layer: ILayer; engine: IEngine }>();
const root = useTemplateRef('root');

// The sprite's stylesheet lives inside its ShadowRoot (see mountSprite) —
// these rules apply per sprite, isolated from the consuming site's CSS.
const spriteStyles = `
	.c-map-layer {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;

		/* --counter-scale-from clamps the viewport scale the counter-scale
		   formula sees: below that scale --scale freezes, so the sprite's
		   marks ride the map instead of growing relative to it as the user
		   zooms further out. Unset (0) leaves the scale unclamped. */
		--inverted-factor: (1 - var(--scale-factor, 0.6));
		--muliplied-factor: max(var(--viewport-scale, 1), var(--counter-scale-from, 0)) *
			var(--scale-factor, 0.6);
		--scale: calc(var(--muliplied-factor) + var(--inverted-factor));

		& [stroke] {
			stroke-width: calc(20px / var(--scale, 1));
		}

		& [stroke-width] {
			stroke-width: calc(var(--default-stroke-width) / var(--scale, 1));
		}

		& [id*='scale_'] {
			transform-box: fill-box;
			transform-origin: var(--scale-origin, center);
			transform: scale(calc(1 / var(--scale)));

			& [stroke] {
				stroke-width: 20px;
			}

			& [stroke-width] {
				stroke-width: var(--default-stroke-width);
			}
		}

		& [data-scale-factor] {
			--inverted-factor: (1 - var(--scale-factor, 0.6));
			--muliplied-factor: max(var(--viewport-scale, 1), var(--counter-scale-from, 0)) *
				var(--scale-factor, 0.6);
			--scale: calc(var(--muliplied-factor) + var(--inverted-factor));
		}
	}
`;

// v-if (via <Transition>) so hidden layers are actually removed from the
// DOM rather than sitting invisible forever — a map can have a dozen-plus
// toggleable/building-highlight/floor layers, most hidden most of the time.
const isVisible = computed(
	() =>
		(props.layer.visible || props.layer.forceVisible) &&
		(props.layer.floor === undefined ||
			props.layer.floor === props.engine.selectedFloor?.id)
);

// The appear/disappear fade is driven frame-by-frame in JS (mirroring
// setOpacity below and the viewport's own animateTo) rather than a native
// CSS `transition`. A CSS transition here promotes the wrapper to its own
// compositing layer, and on iOS Safari that layer's rasterized bitmap
// doesn't reliably get re-tiled while the ancestor `.c-map-viewport` is
// simultaneously mid-transform (e.g. selectPoint's zoomTo, which always
// runs alongside updateBuildingHighlights' forceVisible flip) — the result
// is a blurry, dropped-frame fade exactly when a highlight pops in during a
// zoom. Writing the value imperatively every frame sidesteps that
// layer-promotion path entirely, same as setOpacity already does safely.
let frameId: number | undefined;

function onEnter(element: Element, done: () => void) {
	tween(element as HTMLElement, 0, 1, done);
}

function onLeave(element: Element, done: () => void) {
	tween(element as HTMLElement, 1, 0, done);
}

function tween(
	element: HTMLElement,
	from: number,
	to: number,
	done: () => void
) {
	if (frameId !== undefined) {
		cancelAnimationFrame(frameId);
	}

	const duration = getTransitionDuration(element);
	const start = performance.now();

	element.style.opacity = `${from}`;

	function step(now: number) {
		const progress = Math.min((now - start) / duration, 1);
		const eased = props.engine.focusAnimation.easing(progress);
		element.style.opacity = `${from + (to - from) * eased}`;

		if (progress < 1) {
			frameId = requestAnimationFrame(step);
		} else {
			frameId = undefined;
			done();
		}
	}

	frameId = requestAnimationFrame(step);
}

onBeforeUnmount(() => {
	if (frameId !== undefined) {
		cancelAnimationFrame(frameId);
	}
});

// Duration stays CSS-configurable (e.g. via [data-layer-kind] selectors);
// the easing curve is fixed to engine.focusAnimation's since a CSS linear()
// spring isn't practically re-parseable back into a JS easing function.
function getTransitionDuration(element: HTMLElement): number {
	const raw = getComputedStyle(element)
		.getPropertyValue('--map-layer-transition-duration')
		.trim();

	if (raw.endsWith('ms')) {
		return parseFloat(raw);
	}

	if (raw.endsWith('s')) {
		return parseFloat(raw) * 1000;
	}

	return parseFloat(raw) || 300;
}

// The sprite renders inside a ShadowRoot on the wrapper, not in the light
// DOM: a per-frame/per-zoom-step change to an inherited custom property
// (--viewport-scale) restyles every SVG node, and in light DOM each node is
// re-matched against the consuming site's entire stylesheet (measured at
// ~18ms per step against a ~1200-node sprite on a real solution). Inside a
// ShadowRoot only the sprite's own few rules apply, which makes the same
// recalc ~1-2ms. Custom properties still inherit across the ShadowRoot
// boundary, so --viewport-scale/--scale-factor/--scale-origin keep working.
let sprite: SVGElement | null = null;

function mountSprite(element: HTMLElement) {
	const shadowRoot =
		element.shadowRoot ?? element.attachShadow({ mode: 'open' });
	const attributes = Object.entries(props.layer.sprite.attributes)
		.filter(([key]) => key !== 'class')
		.map(([key, value]) => `${key}="${value}"`)
		.join(' ');

	// Built via the DOM API rather than a template-literal HTML string
	// containing a style element: mkdist's SFC block extraction (used by
	// `nuxt-module-build build` when publishing) finds this component's
	// style block with a plain regex over the raw file text, so a JS
	// string literally spelling out an opening and closing style tag gets
	// mistaken for the real one below and breaks the published build.
	const style = document.createElement('style');
	style.textContent = spriteStyles;

	shadowRoot.innerHTML =
		`<svg class="c-map-layer" overflow="hidden" preserveAspectRatio="xMidYMid slice" ${attributes}>` +
		props.layer.sprite.children +
		'</svg>';
	shadowRoot.prepend(style);

	sprite = shadowRoot.querySelector('svg');
}

// setOpacity drives the sprite's own continuous scale-feather fade (see
// below) via inline style, on every viewport scale change. Kept on the
// sprite rather than the Transition-controlled wrapper so the two
// opacities never fight over the same property — they compound instead,
// since opacity multiplies across nested elements.
//
// v-if destroys and recreates the wrapper every time the layer toggles
// off and back on, so `root` re-resolves to a fresh node each time — a
// plain onMounted (fired once per component instance) would miss every
// remount after the first. Watching the ref itself re-runs setup whenever
// a new node appears.
// Sync flush so the sprite exists the moment the wrapper mounts — the
// ShadowRoot is invisible to Vue's renderer, so nothing else would wait
// for it and a pre/post-flush watcher would leave a one-tick empty frame.
watch(
	root,
	(element) => {
		if (!element) {
			sprite = null;
			return;
		}

		mountSprite(element);
		setVariables();
		setOpacity();
	},
	{ flush: 'sync' }
);

watch(
	() => props.engine.viewport.scale,
	() => setOpacity()
);

function setVariables() {
	sprite?.querySelectorAll('[stroke-width]').forEach((element) => {
		const target = element as SVGElement;
		const value = target.getAttribute('stroke-width');
		target.style.setProperty('--default-stroke-width', value);
	});

	// Per-element escape hatch for scale_ content whose own pivot point
	// isn't the layer's `scaleOrigin` default (e.g. a directional marker
	// that should scale from its tip rather than its center) — authored
	// directly on the SVG element, since the id triggering the scale_
	// behavior is consumer content the package doesn't otherwise know about.
	sprite?.querySelectorAll('[data-scale-origin]').forEach((element) => {
		const target = element as SVGElement;
		const value = target.getAttribute('data-scale-origin');
		target.style.setProperty('transform-origin', value);
	});

	// Same escape hatch for `scaleFactor` — lets one element counter-scale
	// more/less strongly than the rest of its layer (e.g. an arrow that
	// should stay closer to constant screen size than its layer's default).
	// `--scale-factor` is a custom property, so setting it inline here
	// overrides the layer-wide value for just this element and everything
	// the `[id*='scale_']` rule computes from it (`--scale`, `transform`).
	sprite?.querySelectorAll('[data-scale-factor]').forEach((element) => {
		const target = element as SVGElement;
		const value = target.getAttribute('data-scale-factor');
		target.style.setProperty('--scale-factor', value);
	});
}

function setOpacity() {
	const { minScale, maxScale, scaleFeather } = props.layer.sprite;
	const { scale } = props.engine.viewport;
	let opacity = 1;

	if (minScale) {
		const minLower = minScale - scaleFeather;
		const minUpper = minScale + scaleFeather;

		if (scale >= minLower && scale <= minUpper) {
			opacity = (scale - minLower) / (minUpper - minLower);
		}

		if (scale < minLower) {
			opacity = 0;
		}
	}

	if (maxScale) {
		const maxLower = maxScale - scaleFeather;
		const maxUpper = maxScale + scaleFeather;

		if (scale >= maxLower && scale <= maxUpper) {
			opacity = 1 - (scale - maxLower) / (maxUpper - maxLower);
		}

		if (scale > maxUpper) {
			opacity = 0;
		}
	}

	sprite?.style.setProperty('opacity', `${opacity}`);
}
</script>

<style>
:where(.c-map-layer-transition) {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;

	/* Read by getTransitionDuration() below — no native `transition`
	   property here; see the comment on the fade functions for why.
	   Override per instance, e.g. via [data-layer-kind]. */
	--map-layer-transition-duration: 300ms;
}
</style>
