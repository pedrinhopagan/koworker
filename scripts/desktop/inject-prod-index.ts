import { requireReplace } from "./require-replace";

export function buildProductionIndexHtml(sourceIndex: string, appVersion: string): string {
	const prodScript = `<script>
      window.__KOWORK_ENV__ = "production";
      window.__KOWORK_APP_VERSION__ = "${appVersion}";
    </script>`;

	const withAbsoluteCss = requireReplace(
		sourceIndex,
		'href="./index.css"',
		'href="/index.css"',
		"apontar index.css para caminho absoluto",
	);

	const withAbsoluteScript = requireReplace(
		withAbsoluteCss,
		'src="./main.tsx"',
		'src="/main.js"',
		"apontar o bundle principal para /main.js",
	);

	return requireReplace(
		withAbsoluteScript,
		/<script>\s*window\.__KOWORK_ENV__[\s\S]*?<\/script>/,
		prodScript,
		'injetar __KOWORK_ENV__ = "production" no index.html de produção',
	);
}
