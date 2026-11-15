import { basename } from "node:path";

const DOM_TEST_SUFFIX = ".dom.test.";
const npmExecPath = process.env.npm_execpath;
const bunExecutable =
	npmExecPath && /^bun(?:\.exe)?$/u.test(basename(npmExecPath)) ? npmExecPath : process.execPath;

const allTests = [...new Bun.Glob("**/*.{test,spec}.{ts,tsx}").scanSync({ cwd: process.cwd() })]
	.filter((path) => !path.startsWith("node_modules/"))
	.sort();

const domTests = allTests.filter((path) => path.includes(DOM_TEST_SUFFIX));
const nodeTests = allTests.filter((path) => !path.includes(DOM_TEST_SUFFIX));

function run(args: string[], env?: Record<string, string>) {
	const result = Bun.spawnSync([bunExecutable, "test", ...args], {
		stdio: ["inherit", "inherit", "inherit"],
		...(env ? { env: { ...process.env, ...env } } : {}),
	});

	return result.exitCode;
}

const nodeExitCode = nodeTests.length > 0 ? run(nodeTests) : 0;
// React só publica `act` no build de desenvolvimento: com NODE_ENV de produção o
// @testing-library cai no `react-dom/test-utils` antigo e todo teste de DOM estoura.
const domExitCode =
	domTests.length > 0
		? run(["--conditions=development", "--preload", "./tests/web/setup-dom.ts", ...domTests], {
				NODE_ENV: "development",
			})
		: 0;

process.exit(nodeExitCode || domExitCode);
