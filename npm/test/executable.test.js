import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { resolveCommand } from "../cli/paths.js";

test("Windows npm uses npm_execpath JavaScript when available", () => {
  const resolved = resolveCommand("npm", ["install"], {
    platform: "win32",
    nodeExecPath: "C:\\Program Files\\nodejs\\node.exe",
    env: {
      PATH: "",
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
      npm_execpath: "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
    },
  });
  assert.equal(resolved.command, "C:\\Program Files\\nodejs\\node.exe");
  assert.deepEqual(resolved.args, ["C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js", "install"]);
  assert.equal(resolved.via, "npm_execpath");
});

test("Windows npm.cmd shim is invoked through cmd.exe without shell:true", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-win-path-"));
  const npmCmd = join(directory, "npm.cmd");
  await writeFile(npmCmd, "@echo off\n");
  const resolved = resolveCommand("npm", ["install", "--omit=dev"], {
    platform: "win32",
    env: {
      PATH: directory,
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
    },
  });
  assert.equal(resolved.command, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(resolved.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.match(resolved.args[3], /npm\.cmd/i);
  assert.match(resolved.args[3], /install/);
  assert.equal(resolved.via, "cmd-shim");
});

test("POSIX command resolution keeps direct executable invocation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-posix-path-"));
  const executable = join(directory, "npm");
  await writeFile(executable, "#!/bin/sh\n");
  const resolved = resolveCommand("npm", ["install"], {
    platform: "darwin",
    env: {
      PATH: `${directory}${delimiter}/usr/bin`,
    },
  });
  assert.equal(resolved.command, executable);
  assert.deepEqual(resolved.args, ["install"]);
  assert.equal(resolved.via, "path");
});
