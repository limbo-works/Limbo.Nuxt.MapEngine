import type { ISize, ISprite, IViewportPadding } from '../types';

export function getSpriteSize(sprite: ISprite): ISize | undefined {
	const { viewBox } = sprite.attributes;
	if (viewBox) {
		const [, , width, height] = viewBox.split(/[\s,]+/).map(Number);
		if (width > 0 && height > 0) {
			return { width, height };
		}
	}

	const width = Number(sprite.attributes.width);
	const height = Number(sprite.attributes.height);
	if (width > 0 && height > 0) {
		return { width, height };
	}
}

export function normalizePadding(
	padding: number | IViewportPadding
): Required<IViewportPadding> {
	if (typeof padding === 'number') {
		return { top: padding, right: padding, bottom: padding, left: padding };
	}

	return {
		top: padding.top ?? 0,
		right: padding.right ?? 0,
		bottom: padding.bottom ?? 0,
		left: padding.left ?? 0,
	};
}
