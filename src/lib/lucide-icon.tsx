import * as LucideIcons from "lucide-react";

type LucideIconProps = {
	name?: string;
	className?: string;
	style?: React.CSSProperties;
};

export function LucideIcon({ name, className, ...props }: LucideIconProps) {
	const IconComponent = name
		? LucideIcons.icons[name as keyof typeof LucideIcons.icons]
		: LucideIcons.FolderOpen;

	const ResolvedIcon = IconComponent ?? LucideIcons.FolderOpen;

	return <ResolvedIcon className={className} {...props} />;
}
