import { cn } from "@/lib/utils";

// O circuito da cobrinha em 12 passos: desce serpenteando (topo →, meio ←, base →) e volta pelo meio
// (→, ←) até a célula inicial, então o passo 13 é o 1 de novo e o loop fecha sem salto. O índice do
// array é a célula do grid; os valores são os passos em que ela acende — as três do meio acendem duas
// vezes por volta, uma na ida e uma na volta.
const SNAKE_STEPS = [[0], [1], [2], [5, 11], [4, 10], [3, 9], [6], [7], [8]];

const STEP = 0.1;

type SnakeLoaderProps = {
	size?: "sm" | "md";
	className?: string;
	label?: string;
};

// Indicador de "andando" sem giro: nove blocos em 3x3 que acendem em sequência. Herda a cor do texto
// do pai (`text-primary`, `text-warning`...), então o mesmo componente serve a qualquer status.
export function SnakeLoader({ size = "sm", className, label }: SnakeLoaderProps) {
	return (
		<span
			role="status"
			aria-label={label ?? "Trabalhando"}
			className={cn(
				"grid shrink-0 grid-cols-3 grid-rows-3",
				size === "sm" ? "size-3 gap-px" : "size-4 gap-[1.5px]",
				className,
			)}
		>
			{SNAKE_STEPS.map((steps, cell) => (
				<span key={cell} className="relative bg-current/20" aria-hidden>
					{steps.map((step) => (
						<span
							key={step}
							className="absolute inset-0 animate-snake-cell bg-current"
							style={{ animationDelay: `${step * STEP}s` }}
						/>
					))}
				</span>
			))}
		</span>
	);
}
