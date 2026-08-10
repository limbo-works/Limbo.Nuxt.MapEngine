import type { ISize, IVector } from './geometry';
import type { ILayer } from './layer';

export interface IViewport {
	center: IVector;
	scale: number;
	minScale: number;
	maxScale: number;
	size: ISize;
	wheelSensitivity: number;
	momentum: number;

	pan(delta: IVector, options?: IViewportAnimationOptions): void;
	zoomTo(point: IVector, scale: number, options?: IViewportZoomOptions): void;
	zoomBy(
		factor: number,
		origin?: IVector,
		options?: IViewportAnimationOptions
	): void;
	fitToPoints(points: IVector[], options?: IViewportFitOptions): void;
	stop(): void;

	worldToScreen(point: IVector): IVector;
	screenToWorld(point: IVector): IVector;

	getTransform(): IViewportTransform;
	setElement(element: HTMLElement | null): void;
}

export interface IViewportOptions {
	layers?: ILayer[];
	worldSize?: ISize;
	// Initial view (SoW §3.2 — the editor-defined starting zoom level).
	// Clamped against minScale/maxScale and center bounds on init, same as
	// any other zoomTo/pan target.
	center?: IVector;
	scale?: number;
	minScale?: number;
	maxScale?: number;
	duration?: number;
	easing?: (t: number) => number;
	wheelSensitivity?: number;
	momentum?: number;
}

export interface IViewportAnimationOptions {
	duration?: number;
	easing?: (t: number) => number;
}

export interface IViewportZoomOptions extends IViewportAnimationOptions {
	origin?: IVector;
}

// Per-side override for fitToPoints, e.g. a left-side panel occluding part
// of the viewport — unset sides default to 0, not the uniform fallback
// (pass a plain number for that instead).
export interface IViewportPadding {
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
}

export interface IViewportFitOptions extends IViewportAnimationOptions {
	padding?: number | IViewportPadding;
	maxScale?: number;
}

export interface IViewportTransform {
	x: number;
	y: number;
	scale: number;
	width: number;
	height: number;
}
