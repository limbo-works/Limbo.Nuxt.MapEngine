import { reactive } from 'vue';
import type { IGroup, IGroupOptions } from '../types';

export default (options: IGroupOptions): IGroup => {
	return reactive<IGroup>({
		id: options.id,
		label: options.label,
		color: options.color,
		textColor: options.textColor,
	});
};
