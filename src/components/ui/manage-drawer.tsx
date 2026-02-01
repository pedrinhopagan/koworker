import type { ReactNode } from "react";

import type { ManageDrawerKey } from "@/stores/manage-drawers";
import { useManageDrawerStore } from "@/stores/manage-drawers";
import { Drawer } from "./drawer";

type ManageDrawerProps = {
	drawerKey: ManageDrawerKey;
	title: string;
	description?: string;
	children: ReactNode;
	widthClassName?: string;
};

/**
 * Reusable wrapper around <Drawer/> that centralizes open/close state in a store.
 *
 * This avoids local state bugs (e.g. "opens once, never opens again") and makes the
 * drawer reusable across the app.
 */
export function ManageDrawer({
	drawerKey,
	title,
	description,
	children,
	widthClassName,
}: ManageDrawerProps) {
	const open = useManageDrawerStore((s) => Boolean(s.openByKey[drawerKey]));
	const close = useManageDrawerStore((s) => s.close);

	return (
		<Drawer
			open={open}
			onClose={() => close(drawerKey)}
			title={title}
			description={description}
			widthClassName={widthClassName}
		>
			{children}
		</Drawer>
	);
}
