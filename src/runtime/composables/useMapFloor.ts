import { reactive } from 'vue';
import type { IFloor, IFloorOptions } from '../types';

export default (options: IFloorOptions): IFloor => {
	return reactive<IFloor>({
		id: options.id,
		label: options.label,
	});
};
