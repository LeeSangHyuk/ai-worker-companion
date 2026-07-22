import { resolvePaths } from "./paths.js";
import { formatVersion } from "./paths.js";
import { doctorReport, formatDoctorReport } from "./doctor.js";
import { install, uninstall } from "./install.js";

function usage() {
  console.log(`Usage: awc <command> [options]

Commands:
  install       Install AWC for the current user
  uninstall     Remove only AWC-managed files and settings
  doctor        Check the AWC and OpenCode installation
  version       Print the AWC version

Options:
  --skip-deps   Skip dependency installation (install only)
  -v, --version Print the AWC version
  -h, --help    Show this help`);
}

export async function main(argv, { env = process.env } = {}) {
  const [command, ...flags] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    return 0;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    if (flags.length > 0) {
      console.error(`Unknown option: ${flags[0]}`);
      usage();
      return 2;
    }
    console.log(formatVersion());
    return 0;
  }
  const allowedFlags = command === "install" ? new Set(["--skip-deps"]) : new Set();
  const invalidFlag = flags.find((flag) => !allowedFlags.has(flag));
  if (invalidFlag) {
    console.error(`Unknown option: ${invalidFlag}`);
    usage();
    return 2;
  }
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
      const report = await doctorReport(paths, { env });
      console.log(formatDoctorReport(report));
      return report.checks.every((check) => check.ok) ? 0 : 1;
    }
    console.error(`Unknown command: ${command}`);
    usage();
    return 2;
  } catch (error) {
    console.error(`AWC ${command ?? "command"} failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
