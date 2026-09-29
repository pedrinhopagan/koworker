export type ProjectRouteItem = {
	id: string;
	projectId: string;
	name: string;
	route: string;
	icon?: string;
	command?: string;
	background?: boolean;
	displayOrder: number;
};

export type CreateRouteInput = {
	projectId: string;
	name: string;
	route: string;
	icon?: string;
	command?: string;
	background?: boolean;
};

export type UpdateRouteInput = {
	id: string;
	name?: string;
	route?: string;
	icon?: string;
	command?: string;
	background?: boolean;
};

export type DeleteRouteInput = {
	id: string;
};

export type ReorderRoutesInput = {
	orderedIds: string[];
};
