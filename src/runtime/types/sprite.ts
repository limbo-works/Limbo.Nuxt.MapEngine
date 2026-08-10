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
}

export interface ISpriteOptions {
	data: string;
	minScale?: number;
	maxScale?: number;
	scaleFeather?: number;
	scaleFactor?: number;
	scaleOrigin?: string;
}
