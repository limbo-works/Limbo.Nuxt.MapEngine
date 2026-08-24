export interface ISprite {
	data: string;
	children: string;
	// The root <svg> tag's attributes as a plain record — v-bindable as-is
	attributes: Record<string, string>;

	minScale?: number;
	maxScale?: number;
	scaleFeather: number;
	scaleFactor: number;
	scaleOrigin: string;
	counterScaleFrom?: number;
}

export interface ISpriteOptions {
	data: string;
	minScale?: number;
	maxScale?: number;
	scaleFeather?: number;
	scaleFactor?: number;
	scaleOrigin?: string;
	// Viewport scale where counter-scaling starts. Below it the formula's
	// viewport scale is clamped to this value, freezing `--scale` — the
	// sprite's marks then simply scale with the map instead of growing
	// relative to it as the user zooms further out.
	counterScaleFrom?: number;
}
