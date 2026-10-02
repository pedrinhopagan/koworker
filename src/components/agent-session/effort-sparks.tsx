import { useEffect, useRef } from "react";

type Spark = {
	x: number;
	y: number;
	r: number;
	vy: number;
	sway: number;
	phase: number;
	life: number;
	span: number;
};

const SPARK_LIMIT = 30;
const SPAWN_EVERY_S = 0.14;

// As faíscas que sobem quando o esforço está no máximo (o "Max" do prompt bar do React Bits): o
// estado real que elas marcam é o modelo pensando no teto. Some com `prefers-reduced-motion`.
export function EffortSparks({ active }: { active: boolean }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (
			!active ||
			!canvas ||
			!context ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}

		const color = getComputedStyle(canvas).color;
		const sparks: Spark[] = [];
		let frame = 0;
		let last = performance.now();
		let width = 0;
		let height = 0;
		let due = 0;

		function resize() {
			const rect = canvas!.getBoundingClientRect();
			const ratio = Math.min(2, window.devicePixelRatio || 1);
			width = rect.width;
			height = rect.height;
			canvas!.width = Math.round(width * ratio);
			canvas!.height = Math.round(height * ratio);
			context!.setTransform(ratio, 0, 0, ratio, 0, 0);
		}

		function spawn(burst: boolean) {
			sparks.push({
				x: Math.random() * width,
				y: burst ? height * (0.2 + Math.random() * 0.8) : height + 3,
				r: 0.9 + Math.random() * 1.1,
				vy: -(7 + Math.random() * 9),
				sway: (Math.random() - 0.5) * 10,
				phase: Math.random() * Math.PI * 2,
				life: burst ? Math.random() * 1.2 : 0,
				span: 2.4 + Math.random() * 2.4,
			});
		}

		function tick(now: number) {
			const delta = Math.min(0.05, (now - last) / 1000);
			last = now;
			due += delta;
			while (due > SPAWN_EVERY_S) {
				due -= SPAWN_EVERY_S;
				if (sparks.length < SPARK_LIMIT) {
					spawn(false);
				}
			}

			context!.clearRect(0, 0, width, height);
			context!.fillStyle = color;
			context!.shadowColor = color;
			context!.shadowBlur = 6;
			for (let index = sparks.length - 1; index >= 0; index--) {
				const spark = sparks[index]!;
				spark.life += delta;
				if (spark.life > spark.span) {
					sparks.splice(index, 1);
					continue;
				}
				const twinkle = 0.7 + 0.3 * Math.sin(now / 160 + spark.phase);
				spark.y += spark.vy * delta;
				const edge = Math.min(1, Math.max(0, spark.y / 14), Math.max(0, (height - spark.y) / 14));
				context!.globalAlpha =
					Math.min(1, Math.sin((spark.life / spark.span) * Math.PI) * 0.9 * twinkle) * edge;
				context!.beginPath();
				context!.arc(
					spark.x + Math.sin(now / 900 + spark.phase) * spark.sway,
					spark.y,
					spark.r * twinkle,
					0,
					Math.PI * 2,
				);
				context!.fill();
			}
			frame = requestAnimationFrame(tick);
		}

		resize();
		for (let index = 0; index < 26; index++) {
			spawn(true);
		}
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		frame = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			context.clearRect(0, 0, width, height);
		};
	}, [active]);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden
			className="pointer-events-none absolute inset-0 -z-10 size-full text-primary"
		/>
	);
}
