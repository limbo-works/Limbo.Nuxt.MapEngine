import { reactive } from 'vue';
import useMapSprite from './useMapSprite';
import type { ILayer, ILayerOptions } from '../types';

export default (options: ILayerOptions): ILayer => {
	const sprite = useMapSprite({
		data: options.sprite,
		minScale: options.minScale,
		maxScale: options.maxScale,
		scaleFeather: options.scaleFeather,
		scaleFactor: options.scaleFactor,
		scaleOrigin: options.scaleOrigin,
		counterScaleFrom: options.counterScaleFrom,
	});

	// Building highlights have no label (they're not user-toggleable pills)
	// but still default closed — they're only ever shown via forceVisible,
	// same as the labeled walking-routes layer.
	const closedByDefault =
		options.label !== undefined || options.kind === 'building-highlight';

	return reactive<ILayer>({
		visible: closedByDefault ? (options.enabled ?? false) : true,
		forceVisible: false,
		name: options.name,
		label: options.label,
		color: options.color,
		kind: options.kind,
		floor: options.floor,
		sprite,
	});
};
