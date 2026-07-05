import { SidebarNavContent } from "@/components/layout/sidebar-nav-content";
import { isTabActive, tabs } from "@/components/layout/tab-nav-config";
import { Drawer } from "@/components/ui/drawer";

type MobileNavDrawerProps = {
	open: boolean;
	onClose: () => void;
};

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
	return (
		<Drawer open={open} onClose={onClose} side="left" title="Navegação">
			<SidebarNavContent variant="drawer" onNavigate={onClose} />
		</Drawer>
	);
}

export function getActiveTabLabel(currentPath: string): string {
	const active = tabs.find((tab) => isTabActive(currentPath, tab.path));
	return active?.label ?? "Menu";
}
