import { LucideIcon } from "@/lib/lucide-icon";
import { CustomSelect } from "./custom-select";

const AVAILABLE_ICONS = [
	{ id: "Monitor", name: "Monitor" },
	{ id: "Server", name: "Server" },
	{ id: "Code2", name: "Code2" },
	{ id: "Database", name: "Database" },
	{ id: "Globe", name: "Globe" },
	{ id: "Rocket", name: "Rocket" },
	{ id: "ListChecks", name: "ListChecks" },
	{ id: "CirclePlay", name: "CirclePlay" },
	{ id: "FileSearch", name: "FileSearch" },
	{ id: "GitCommitHorizontal", name: "GitCommitHorizontal" },
	{ id: "Wrench", name: "Wrench" },
	{ id: "Terminal", name: "Terminal" },
	{ id: "FolderOpen", name: "FolderOpen" },
	{ id: "Package", name: "Package" },
	{ id: "Settings", name: "Settings" },
	{ id: "Cpu", name: "Cpu" },
	{ id: "Box", name: "Box" },
	{ id: "Layout", name: "Layout" },
	{ id: "Network", name: "Network" },
	{ id: "Cloud", name: "Cloud" },
];

type IconPickerProps = {
	value?: string;
	onChange: (icon: string) => void;
	className?: string;
};

export function IconPicker({ value, onChange, className }: IconPickerProps) {
	return (
		<CustomSelect
			items={AVAILABLE_ICONS}
			value={value || "FolderOpen"}
			onValueChange={onChange}
			variant="default"
			size="sm"
			triggerClassName={className}
			renderTrigger={() => <LucideIcon name={value || "FolderOpen"} className="size-4" />}
			renderItem={(item) => (
				<div className="flex items-center gap-2 px-3 py-2">
					<LucideIcon name={item.id} className="size-4" />
					<span className="text-sm">{item.name}</span>
				</div>
			)}
		/>
	);
}
