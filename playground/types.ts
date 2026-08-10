export interface IMapContentBlock {
	alias: string;
	title?: string;
	[key: string]: unknown;
}

export interface IMapPointLink {
	url: string;
	target?: string;
}

// This demo site's own IPoint.content payload — the engine treats it as
// opaque; this shape (icon markup, an outgoing link, and/or content-overlay
// blocks) is entirely this playground's choice, not part of the engine.
export interface IMapPointContent {
	icon?: string;
	link?: IMapPointLink;
	blocks?: IMapContentBlock[];
}
