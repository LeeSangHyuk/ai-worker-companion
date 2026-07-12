import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { doctor } from "../cli/doctor.js";
import { install } from "../cli/install.js";
import { resolvePaths } from "../cli/paths.js";

async function environment() {
  const home = await mkdtemp(join(tmpdir(), "awc-doctor-"));
  const bin = join(home, "bin");
  const env = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: join(home, "config"),
    XDG_DATA_HOME: join(home, "data"),
    AWC_SKIP_DEPENDENCY_INSTALL: "1",
    PATH: `${bin}${delimiter}${process.env.PATH}`,
  };
  await mkdir(bin, { recursive: true });
  const executable = join(bin, "opencode");
  await writeFile(executable, "#!/bin/sh\necho 1.15.12\n");
  await chmod(executable, 0o755);
  return { env, paths: resolvePaths(env) };
}

test("doctor reports a complete temporary installation", async () => {
  const { env, paths } = await environment();
  await install(paths, { env });
  await mkdir(join(paths.runtimeDir, "node_modules/@opentui/solid"), { recursive: true });
  await writeFile(join(paths.runtimeDir, "node_modules/@opentui/solid/package.json"), "{}\n");
  await mkdir(join(paths.dataHome, "opencode"), { recursive: true });
  await writeFile(paths.database, "fixture");
  const checks = await doctor(paths, { env });
  assert.equal(checks.every((check) => check.ok), true, JSON.stringify(checks, null, 2));
});

test("doctor reports missing installation files", async () => {
  const { env, paths } = await environment();
  const checks = await doctor(paths, { env });
  assert.equal(checks.some((check) => !check.ok), true);
  assert.equal(checks.find((check) => check.name === "AWC manifest")?.ok, false);
});
