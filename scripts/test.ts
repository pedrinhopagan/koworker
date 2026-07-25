const DOM_TEST_SUFFIX = ".dom.test.";

const allTests = [...new Bun.Glob("**/*.{test,spec}.{ts,tsx}").scanSync({ cwd: process.cwd() })]
	.filter((path) => !path.startsWith("node_modules/"))
	.sort();

const domTests = allTests.filter((path) => path.includes(DOM_TEST_SUFFIX));
const nodeTests = allTests.filter((path) => !path.includes(DOM_TEST_SUFFIX));

function run(args: string[]) {
	const result = Bun.spawnSync(["bun", "test", ...args], {
		stdio: ["inherit", "inherit", "inherit"],
	});

	return result.exitCode;
}

const nodeExitCode = nodeTests.length > 0 ? run(nodeTests) : 0;
const domExitCode =
	domTests.length > 0 ? run(["--preload", "./tests/web/setup-dom.ts", ...domTests]) : 0;

process.exit(nodeExitCode || domExitCode);
