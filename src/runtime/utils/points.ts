import type { IGroup, IPoint } from '../types';

// SoW §3.3: only clickable POIs take part in grouping — bare icons are
// skipped even when tagged with a group id. Shared by getGroupPoints and
// the per-point visibility check while a group is active.
export function isPointInGroup(point: IPoint, group: IGroup): boolean {
	return point.clickable && point.groups.includes(group.id);
}
