import { reactive } from 'vue';
import { clamp, clampCenter, easeOutCubic, lerp } from '../utils/math';
import { onUpdate } from '../utils/update';
import { getSpriteSize, normalizePadding } from '../utils/viewport';
import type {
	ISize,
	IVector,
	IViewport,
	IViewportAnimationOptions,
	IViewportFitOptions,
	IViewportOptions,
	IViewportTransform,
	IViewportZoomOptions,
} from '../types';

/**
 * Pan/zoom state for the map, working across three coordinate spaces:
 *
 * - World-pixel space: the raw coordinates used by `IPoint.position`,
 *   authored in the reference layer's native SVG units.
 * - Normalized space: `viewport.center` lives in `[0, 1]` of the world,
 *   independent of world size — stable enough to share a view via URL.
 * - Screen-pixel space: pixels relative to the `.c-map-viewport` element.
 *
 * `viewport.scale` is a multiplier on top of cover-fit; `scale = 1` is the
 * smallest scale that fully covers the viewport (`object-fit: cover` math).
 *
 * Usage (`useMapEngine` creates the viewport as `engine.viewport`):
 *
 * const engine = useMapEngine();
 *
 * <MapEngine :engine="engine" />
 *
 * // POI focus, e.g. from a MapPoint click handler:
 * engine.viewport.zoomTo(point.position, 4);
 * // or off-center, leaving room for a panel on the left:
 * engine.viewport.zoomTo(point.position, 4, { origin: { x: 0.75, y: 0.5 } });
 */
export default (options: IViewportOptions = {}): IViewport => {
	const minScale = options.minScale ?? 0.5;
	const maxScale = options.maxScale ?? 40;
	const defaultDuration = options.duration ?? 600;
	const defaultEasing = options.easing ?? easeOutCubic;

	const size = reactive<ISize>({ width: 0, height: 0 });
	let observer: ResizeObserver | null = null;

	const animation = {
		active: false,
		elapsed: 0,
		duration: defaultDuration,
		easing: defaultEasing,
		from: { center: { x: 0.5, y: 0.5 }, scale: 1 },
		to: { center: { x: 0.5, y: 0.5 }, scale: 1 },
		anchor: null as {
			world: IVector;
			screenFrom: IVector;
			screenTo: IVector;
		} | null,
	};

	// The two input-feel knobs deliberately stay this narrow: touch pinch
	// and drag are geometric (the world point under a finger stays under
	// it) and must not have speed multipliers, while wheel deltas and
	// momentum taste genuinely vary per device. Both are multipliers with
	// default 1; momentum 0 disables the release glide.
	const viewport = reactive<IViewport>({
		center: clampCenter(options.center ?? { x: 0.5, y: 0.5 }),
		scale: clamp(options.scale ?? 1, minScale, maxScale),
		minScale,
		maxScale,
		size,

		wheelSensitivity: options.wheelSensitivity ?? 0.5,
		momentum: options.momentum ?? 1,

		pan,
		zoomTo,
		zoomBy,
		fitToPoints,
		stop,
		worldToScreen,
		screenToWorld,
		getTransform,
		setElement,
	});

	function getWorldSize(): ISize {
		if (options.worldSize) {
			return options.worldSize;
		}

		// Layers are not positioned relative to each other in a shared world
		// frame (every layer is stretched to the same box) — until that
		// exists, the largest layer's native SVG dimensions define the world.
		let world: ISize = { width: 1, height: 1 };
		for (const layer of options.layers ?? []) {
			const spriteSize = getSpriteSize(layer.sprite);
			if (
				spriteSize &&
				spriteSize.width * spriteSize.height >
					world.width * world.height
			) {
				world = spriteSize;
			}
		}

		return world;
	}

	function getBaseScale(): number {
		const world = getWorldSize();
		if (!size.width || !size.height) {
			return 1;
		}

		return Math.max(size.width / world.width, size.height / world.height);
	}

	function getTarget() {
		if (animation.active) {
			return animation.to;
		}

		return {
			center: { ...viewport.center },
			scale: viewport.scale,
		};
	}

	function animateTo(
		target: { center: IVector; scale: number },
		animationOptions?: IViewportAnimationOptions,
		anchor?: { world: IVector; screenFrom: IVector; screenTo: IVector }
	) {
		animation.from = {
			center: { ...viewport.center },
			scale: viewport.scale,
		};

		animation.to = {
			center: clampCenter(target.center),
			scale: clamp(target.scale, minScale, maxScale),
		};

		animation.anchor = anchor ?? null;
		animation.elapsed = 0;
		animation.duration = animationOptions?.duration ?? defaultDuration;
		animation.easing = animationOptions?.easing ?? defaultEasing;
		animation.active = true;
	}

	function pan(delta: IVector, animationOptions?: IViewportAnimationOptions) {
		const world = getWorldSize();
		const target = getTarget();
		const scale = getBaseScale() * target.scale;

		animateTo(
			{
				center: {
					x: target.center.x - delta.x / (scale * world.width),
					y: target.center.y - delta.y / (scale * world.height),
				},
				scale: target.scale,
			},
			animationOptions
		);
	}

	// POI focus centers the point (standard "click a marker to focus it"
	// behavior); `origin` lets callers place it elsewhere on screen instead,
	// e.g. `{ x: 0.75, y: 0.5 }` to leave room for an overlay panel.
	function zoomTo(
		point: IVector,
		scale: number,
		zoomOptions?: IViewportZoomOptions
	) {
		const world = getWorldSize();
		const origin = zoomOptions?.origin ?? { x: 0.5, y: 0.5 };
		const targetScale = clamp(scale, minScale, maxScale);
		const pixelScale = getBaseScale() * targetScale;

		const screenX = (origin.x - 0.5) * size.width;
		const screenY = (origin.y - 0.5) * size.height;

		// Anchoring on the focused point and easing its screen position
		// keeps pan and zoom on the same easing — lerping center in world
		// space instead would get amplified by the growing scale, making
		// the pan look back-loaded relative to the zoom.
		animateTo(
			{
				center: {
					x: (point.x - screenX / pixelScale) / world.width,
					y: (point.y - screenY / pixelScale) / world.height,
				},
				scale: targetScale,
			},
			zoomOptions,
			{
				world: point,
				screenFrom: worldToScreen(point),
				screenTo: {
					x: origin.x * size.width,
					y: origin.y * size.height,
				},
			}
		);
	}

	function zoomBy(
		factor: number,
		origin?: IVector,
		animationOptions?: IViewportAnimationOptions
	) {
		const world = getWorldSize();
		const base = getBaseScale();

		const targetScale = clamp(
			getTarget().scale * factor,
			minScale,
			maxScale
		);
		const screen = origin ?? { x: size.width / 2, y: size.height / 2 };

		// The anchor is the world point currently rendered under `origin` —
		// taken from the rendered state (not the animation target) so the
		// anchored tween starts exactly where the viewport is now.
		const anchor = {
			x:
				viewport.center.x * world.width +
				(screen.x - size.width / 2) / (base * viewport.scale),
			y:
				viewport.center.y * world.height +
				(screen.y - size.height / 2) / (base * viewport.scale),
		};

		animateTo(
			{
				center: {
					x:
						(anchor.x -
							(screen.x - size.width / 2) /
								(base * targetScale)) /
						world.width,
					y:
						(anchor.y -
							(screen.y - size.height / 2) /
								(base * targetScale)) /
						world.height,
				},
				scale: targetScale,
			},
			animationOptions,
			{ world: anchor, screenFrom: screen, screenTo: screen }
		);
	}

	// Frames all given world points at once (e.g. wayfinding origin +
	// destination). A plain center/scale tween — no anchor, since no single
	// point is the focus. `maxScale` caps how far a tight cluster zooms in;
	// coincident points would otherwise fit at the viewport's own maximum.
	// `padding` also accepts per-side values so a caller can bias the frame
	// away from screen space a UI panel covers (e.g. `{ left: 420 }` for a
	// left-side list) — the fitted points center in what's actually visible
	// rather than the full viewport, the same way `zoomTo`'s `origin` does
	// for a single point.
	function fitToPoints(points: IVector[], fitOptions?: IViewportFitOptions) {
		if (!points.length || !size.width || !size.height) {
			return;
		}

		const world = getWorldSize();
		const base = getBaseScale();
		const padding = normalizePadding(fitOptions?.padding ?? 250);

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const point of points) {
			minX = Math.min(minX, point.x);
			minY = Math.min(minY, point.y);
			maxX = Math.max(maxX, point.x);
			maxY = Math.max(maxY, point.y);
		}

		const available = {
			width: Math.max(size.width - padding.left - padding.right, 1),
			height: Math.max(size.height - padding.top - padding.bottom, 1),
		};

		const scale = Math.min(
			available.width / ((maxX - minX) * base),
			available.height / ((maxY - minY) * base),
			fitOptions?.maxScale ?? maxScale
		);
		const pixelScale = base * scale;

		// Screen-space offset between the full viewport's center and the
		// padded (visible) rectangle's center — e.g. a left panel shifts the
		// visible center right, so the frame's world center is pulled the
		// other way by the same amount in world space.
		const screenOffset = {
			x: (padding.left - padding.right) / 2,
			y: (padding.top - padding.bottom) / 2,
		};

		animateTo(
			{
				center: {
					x:
						(minX + maxX) / 2 / world.width -
						screenOffset.x / (pixelScale * world.width),
					y:
						(minY + maxY) / 2 / world.height -
						screenOffset.y / (pixelScale * world.height),
				},
				scale,
			},
			fitOptions
		);
	}

	// Freezes the viewport where it currently is — lets a pointer "grab"
	// a gliding map mid-momentum.
	function stop() {
		animation.active = false;
	}

	function worldToScreen(point: IVector): IVector {
		const world = getWorldSize();
		const scale = getBaseScale() * viewport.scale;

		return {
			x:
				(point.x - viewport.center.x * world.width) * scale +
				size.width / 2,
			y:
				(point.y - viewport.center.y * world.height) * scale +
				size.height / 2,
		};
	}

	function screenToWorld(point: IVector): IVector {
		const world = getWorldSize();
		const scale = getBaseScale() * viewport.scale;

		return {
			x:
				(point.x - size.width / 2) / scale +
				viewport.center.x * world.width,
			y:
				(point.y - size.height / 2) / scale +
				viewport.center.y * world.height,
		};
	}

	function getTransform(): IViewportTransform {
		const world = getWorldSize();
		const base = getBaseScale();
		const scale = base * viewport.scale;

		return {
			x: size.width / 2 - viewport.center.x * world.width * scale,
			y: size.height / 2 - viewport.center.y * world.height * scale,
			scale: viewport.scale,
			width: world.width * base,
			height: world.height * base,
		};
	}

	function setElement(element: HTMLElement | null) {
		observer?.disconnect();
		observer = null;

		if (element) {
			size.width = element.clientWidth;
			size.height = element.clientHeight;

			observer = new ResizeObserver(([entry]) => {
				size.width = entry.contentRect.width;
				size.height = entry.contentRect.height;
			});

			observer.observe(element);
		}
	}

	onUpdate((delta) => {
		if (!animation.active) {
			return;
		}

		animation.elapsed += delta;
		const progress =
			animation.duration > 0
				? Math.min(animation.elapsed / animation.duration, 1)
				: 1;
		const eased = animation.easing(progress);

		// Scale interpolates multiplicatively so zoom velocity feels
		// constant per octave.
		viewport.scale =
			animation.from.scale *
			Math.pow(animation.to.scale / animation.from.scale, eased);

		if (animation.anchor) {
			// The anchor's screen position is eased along a straight line
			// (fixed for zoomBy, travelling to the origin for zoomTo) and
			// center is derived from it — deriving instead of lerping center
			// keeps the anchored point exactly on that eased path every
			// frame, on the same easing as the scale.
			const world = getWorldSize();
			const scale = getBaseScale() * viewport.scale;
			const { world: anchor, screenFrom, screenTo } = animation.anchor;

			const screen = {
				x: lerp(screenFrom.x, screenTo.x, eased),
				y: lerp(screenFrom.y, screenTo.y, eased),
			};

			const center = clampCenter({
				x:
					(anchor.x - (screen.x - size.width / 2) / scale) /
					world.width,
				y:
					(anchor.y - (screen.y - size.height / 2) / scale) /
					world.height,
			});

			viewport.center.x = center.x;
			viewport.center.y = center.y;
		} else {
			viewport.center.x = lerp(
				animation.from.center.x,
				animation.to.center.x,
				eased
			);
			viewport.center.y = lerp(
				animation.from.center.y,
				animation.to.center.y,
				eased
			);
		}

		if (progress >= 1) {
			animation.active = false;
		}
	});

	return viewport;
};
