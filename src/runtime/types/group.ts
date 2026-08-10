export interface IGroup {
	id: string;
	label: string;
	// Author-supplied CSS colour for the group's pills and its points while
	// the group is active.
	color: string;
	// Optional author-supplied text colour to pair with `color` (e.g. white on
	// a dark pill). Consumers fall back to their own default when unset — the
	// engine never derives it.
	textColor?: string;
}

export interface IGroupOptions {
	id: string;
	label: string;
	color: string;
	textColor?: string;
}
