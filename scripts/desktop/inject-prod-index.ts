import { KOWORK_PROD_API_ORIGIN } from "../../src/lib/runtime-config";

export function buildProductionIndexHtml(sourceIndex: string, appVersion: string): string {
	const prodScript = `<script>
      window.__KOWORK_ENV__ = "production";
      window.__KOWORK_API_URL__ = "${KOWORK_PROD_API_ORIGIN}";
      window.__KOWORK_APP_VERSION__ = "${appVersion}";
    </script>`;

	const builtIndex = sourceIndex
		.replace("./main.tsx", "./main.js")
		.replace(/<script>\s*window\.__KOWORK_ENV__[\s\S]*?<\/script>/, prodScript);

	if (!builtIndex.includes(KOWORK_PROD_API_ORIGIN)) {
		throw new Error(
			`Falha ao injetar __KOWORK_API_URL__ (${KOWORK_PROD_API_ORIGIN}) no index.html de produção`,
		);
	}

	return builtIndex;
}
