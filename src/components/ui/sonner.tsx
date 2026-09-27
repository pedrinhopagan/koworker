import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { Toaster as Sonner } from "sonner";

import { useThemeStore } from "@/stores/theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster(props: ToasterProps) {
	const { theme } = useThemeStore();

	return (
		<Sonner
			{...props}
			theme={theme}
			className="toaster"
			position="bottom-right"
			offset={16}
			mobileOffset={16}
			gap={10}
			visibleToasts={3}
			expand
			closeButton
			swipeDirections={["left", "right"]}
			icons={{
				success: <CircleCheck aria-hidden className="size-[18px]" />,
				error: <CircleAlert aria-hidden className="size-[18px]" />,
				warning: <TriangleAlert aria-hidden className="size-[18px]" />,
				info: <Info aria-hidden className="size-[18px]" />,
				close: <X aria-hidden className="size-4" />,
			}}
			toastOptions={{ closeButtonAriaLabel: "Fechar notificação" }}
		/>
	);
}

export { Toaster };
