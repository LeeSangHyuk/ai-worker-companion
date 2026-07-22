import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../cli/main.js";
import { formatVersion, getPackageVersion } from "../cli/paths.js";

async function capture(args) {
  const output = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values) => output.push(values.join(" "));
  console.error = (...values) => errors.push(values.join(" "));
  try {
    return { code: await main(args), output: output.join("\n"), errors: errors.join("\n") };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test("help is explicit and exits successfully", async () => {
  const result = await capture(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.output, /Usage: awc/);
  assert.match(result.output, /install/);
  assert.match(result.output, /doctor/);
  assert.match(result.output, /version/);
});

test("version commands print package version", async () => {
  const expected = formatVersion(getPackageVersion());
  for (const command of [["version"], ["--version"], ["-v"]]) {
    const result = await capture(command);
    assert.equal(result.code, 0);
    assert.equal(result.output.trim(), expected);
    assert.equal(result.errors, "");
  }
});

test("package version is read from package.json", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-version-"));
  const packageJson = join(directory, "package.json");
  await writeFile(packageJson, JSON.stringify({ version: "9.8.7" }));
  assert.equal(getPackageVersion(packageJson), "9.8.7");
  assert.equal(formatVersion(getPackageVersion(packageJson)), "AI Worker Companion 9.8.7");
});

test("unknown commands and options return usage errors", async () => {
  const command = await capture(["invalid"]);
  assert.equal(command.code, 2);
  assert.match(command.errors, /Unknown command/);

  const option = await capture(["doctor", "--skip-deps"]);
  assert.equal(option.code, 2);
  assert.match(option.errors, /Unknown option/);

  const versionOption = await capture(["version", "--json"]);
  assert.equal(versionOption.code, 2);
  assert.match(versionOption.errors, /Unknown option/);
});
