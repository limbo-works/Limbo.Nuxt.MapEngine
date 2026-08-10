import { reactive } from 'vue';
import type { IPoint, IPointOptions } from '../types';

export default (options: IPointOptions): IPoint => {
	return reactive<IPoint>({
		id: options.id,
		visible: options.visible ?? true,
		selectedAsDestination: false,
		selectedAsOrigin: false,
		label: options.label,
		tags: options.tags ?? [],
		groups: options.groups ?? [],
		buildings: options.buildings ?? [],
		content: options.content,
		clickable: options.clickable ?? true,
		layer: options.layer,
		anchor: options.anchor,

		position: {
			x: options.x ?? 0,
			y: options.y ?? 0,
		},
	});
};
