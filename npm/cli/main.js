import { resolvePaths } from "./paths.js";
import { doctor } from "./doctor.js";
import { install, uninstall } from "./install.js";

function usage() {
  console.log("Usage: awc <install|uninstall|doctor> [--skip-deps]");
}

export async function main(argv, { env = process.env } = {}) {
  const [command, ...flags] = argv;
  const paths = resolvePaths(env);
  try {
    if (command === "install") {
      const result = await install(paths, { env, skipDependencies: flags.includes("--skip-deps") });
      console.log(`AWC installed in ${result.runtimeDir}`);
      return 0;
    }
    if (command === "uninstall") {
      await uninstall(paths);
      console.log("AWC uninstalled. Existing OpenCode settings were preserved.");
      return 0;
    }
    if (command === "doctor") {
      const checks = await doctor(paths, { env });
      for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"}: ${check.name} (${check.detail})`);
      return checks.every((check) => check.ok) ? 0 : 1;
    }
    usage();
    return command ? 2 : 0;
  } catch (error) {
    console.error(`AWC ${command ?? "command"} failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
