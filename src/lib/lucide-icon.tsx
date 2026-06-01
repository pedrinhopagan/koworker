import * as LucideIcons from "lucide-react";

type LucideIconProps = {
	name?: string;
	className?: string;
	style?: React.CSSProperties;
};

export function LucideIcon({ name, className, ...props }: LucideIconProps) {
	const IconComponent =
		name && name in LucideIcons
			? (LucideIcons[name as keyof typeof LucideIcons] as React.ComponentType<{
					className?: string;
					style?: React.CSSProperties;
				}>)
			: LucideIcons.FolderOpen;

	return <IconComponent className={className} {...props} />;
}
