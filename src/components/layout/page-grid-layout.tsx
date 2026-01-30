import { cn } from "@/lib/utils";

interface PageGridLayoutProps {
	children: React.ReactNode;
	className?: string;
}

interface PageGridLayoutSidebarProps {
	children: React.ReactNode;
	className?: string;
}

interface PageGridLayoutContentProps {
	children: React.ReactNode;
	className?: string;
}

function PageGridLayout({ children, className }: PageGridLayoutProps) {
	return <div className={cn("flex-1 flex overflow-hidden flex-col", className)}>{children}</div>;
}

function PageGridLayoutSidebar({ children, className }: PageGridLayoutSidebarProps) {
	return (
		<aside
			className={cn(
				"shrink-0 bg-background border-r border-border h-full overflow-hidden",
				className,
			)}
		>
			{children}
		</aside>
	);
}

function PageGridLayoutContent({ children, className }: PageGridLayoutContentProps) {
	return <div className={cn("flex-1 overflow-y-auto h-full px-6 py-4", className)}>{children}</div>;
}

PageGridLayout.Sidebar = PageGridLayoutSidebar;
PageGridLayout.Content = PageGridLayoutContent;

export { PageGridLayout };
