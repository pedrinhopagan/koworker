export type ProjectRouteItem = {
	id: string;
	projectId: string;
	name: string;
	route: string;
	icon?: string;
	command?: string;
	displayOrder: number;
};

export type CreateRouteInput = {
	projectId: string;
	name: string;
	route: string;
	icon?: string;
	command?: string;
};

export type UpdateRouteInput = {
	id: string;
	name?: string;
	route?: string;
	icon?: string;
	command?: string;
};

export type DeleteRouteInput = {
	id: string;
};

export type ReorderRoutesInput = {
	orderedIds: string[];
};
