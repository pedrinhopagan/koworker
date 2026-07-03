export function buildProductionIndexHtml(sourceIndex: string, appVersion: string): string {
	const prodScript = `<script>
      window.__KOWORK_ENV__ = "production";
      window.__KOWORK_APP_VERSION__ = "${appVersion}";
    </script>`;

	const builtIndex = sourceIndex
		.replace("./main.tsx", "./main.js")
		.replace(/<script>\s*window\.__KOWORK_ENV__[\s\S]*?<\/script>/, prodScript);

	if (!builtIndex.includes('window.__KOWORK_ENV__ = "production"')) {
		throw new Error('Falha ao injetar __KOWORK_ENV__ = "production" no index.html de produção');
	}

	return builtIndex;
}
