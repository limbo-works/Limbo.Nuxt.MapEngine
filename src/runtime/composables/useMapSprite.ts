import type { ISprite, ISpriteOptions } from '../types';

export default (options: ISpriteOptions): ISprite => {
	const { data } = options;

	const tag = data.match(/<svg(.*)>/gm)?.[0] ?? '';
	const attrs = tag.matchAll(/(\w+)="(.+?)"/gm);
	const children = data.match(/<svg.*?>([\S\s]*?)<\/svg>/gm)?.[0] ?? '';

	const attributes: Record<string, string> = {};
	for (const [, key, value] of attrs) {
		attributes[key] = value;
	}

	return {
		data,
		children,
		attributes,
		minScale: options.minScale,
		maxScale: options.maxScale,
		scaleFeather: options.scaleFeather ?? 1,
		scaleFactor: options.scaleFactor ?? 1,
		scaleOrigin: options.scaleOrigin ?? 'center',
		counterScaleFrom: options.counterScaleFrom,
	};
};
