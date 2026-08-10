import type { IVector } from '../types';

export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function lerp(from: number, to: number, t: number): number {
	return from + (to - from) * t;
}

export function midpoint(a: IVector, b: IVector): IVector {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: IVector, b: IVector): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

// Clamped to [0, 1] independent of scale, as specified — note this allows
// panning the world edge all the way to the screen center, leaving up to
// half the viewport empty (most noticeable at low zoom).
export function clampCenter(center: IVector): IVector {
	return {
		x: clamp(center.x, 0, 1),
		y: clamp(center.y, 0, 1),
	};
}

export function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}
