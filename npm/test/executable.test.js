import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { resolveCommand, runCommand } from "../cli/paths.js";

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
  assert.match(resolved.args[3], /^call /);
  assert.match(resolved.args[3], /npm\.cmd/i);
  assert.match(resolved.args[3], /install/);
  assert.equal(resolved.via, "cmd-shim");
  assert.equal(resolved.windowsVerbatimArguments, true);
});

test("Windows command resolution prefers PATHEXT npm.cmd over extensionless npm in the same directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-win-npm-shadow-"));
  await writeFile(join(directory, "npm"), "#!/bin/sh\n");
  await writeFile(join(directory, "npm.cmd"), "@echo off\n");

  const resolved = resolveCommand("npm", ["install"], {
    platform: "win32",
    env: {
      PATH: directory,
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
    },
  });

  assert.equal(resolved.command, "C:\\Windows\\System32\\cmd.exe");
  assert.match(resolved.resolved, /npm\.cmd$/i);
  assert.match(resolved.args[3], /npm\.cmd/i);
  assert.equal(resolved.via, "cmd-shim");
  assert.equal(resolved.windowsVerbatimArguments, true);
});

test("Windows command resolution prefers PATHEXT opencode.exe over extensionless opencode", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-win-opencode-shadow-"));
  await writeFile(join(directory, "opencode"), "#!/bin/sh\n");
  await writeFile(join(directory, "opencode.exe"), "");

  const resolved = resolveCommand("opencode", ["--version"], {
    platform: "win32",
    env: {
      PATH: directory,
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
    },
  });

  assert.match(resolved.command, /opencode\.exe$/i);
  assert.deepEqual(resolved.args, ["--version"]);
  assert.equal(resolved.via, "path");
});

test("Windows command resolution searches PATHEXT candidates across PATH before extensionless files", async () => {
  const firstDirectory = await mkdtemp(join(tmpdir(), "awc-win-first-"));
  const secondDirectory = await mkdtemp(join(tmpdir(), "awc-win-second-"));
  await writeFile(join(firstDirectory, "npm"), "#!/bin/sh\n");
  await writeFile(join(secondDirectory, "npm.cmd"), "@echo off\n");

  const resolved = resolveCommand("npm", ["install"], {
    platform: "win32",
    env: {
      PATH: `${firstDirectory};${secondDirectory}`,
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
    },
  });

  assert.equal(resolved.command, "C:\\Windows\\System32\\cmd.exe");
  assert.match(resolved.resolved, /npm\.cmd$/i);
  assert.equal(resolved.via, "cmd-shim");
  assert.equal(resolved.windowsVerbatimArguments, true);
});

test("Windows command resolution leaves extensionless-only files to native resolution", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-win-extensionless-"));
  await writeFile(join(directory, "npm"), "#!/bin/sh\n");

  const resolved = resolveCommand("npm", ["install"], {
    platform: "win32",
    env: {
      PATH: directory,
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
    },
  });

  assert.equal(resolved.command, "npm");
  assert.deepEqual(resolved.args, ["install"]);
  assert.equal(resolved.resolved, "npm");
  assert.equal(resolved.via, "native-resolution");
});

test("Windows command resolution uses Path when PATH is stale", async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-win-opencode-path-"));
  const opencodeCmd = join(directory, "opencode.cmd");
  await writeFile(opencodeCmd, "@echo off\n");

  const resolved = resolveCommand("opencode", ["--version"], {
    platform: "win32",
    env: {
      PATH: "C:\\stale\\bin",
      Path: directory,
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
    },
  });

  assert.equal(resolved.command, "C:\\Windows\\System32\\cmd.exe");
  assert.match(resolved.resolved, /opencode\.cmd$/i);
  assert.match(resolved.args[3], /opencode\.cmd/i);
  assert.match(resolved.args[3], /--version/);
  assert.equal(resolved.via, "cmd-shim");
  assert.equal(resolved.windowsVerbatimArguments, true);
});

test("Windows command resolution handles spaces in cmd shim paths", async () => {
  const parent = await mkdtemp(join(tmpdir(), "awc-win-space-parent-"));
  const directory = join(parent, "bin with spaces");
  await mkdir(directory);
  await writeFile(join(directory, "npm.cmd"), "@echo off\n");

  const resolved = resolveCommand("npm", ["install", "--omit=dev"], {
    platform: "win32",
    env: {
      PATH: directory,
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
    },
  });

  assert.equal(resolved.command, "C:\\Windows\\System32\\cmd.exe");
  assert.match(resolved.args[3], /^call /);
  assert.match(resolved.args[3], /"[^"]*bin with spaces[^"]*npm\.cmd"/i);
  assert.match(resolved.args[3], /"--omit=dev"/);
});

test("Windows cmd shim execution runs through cmd.exe without shell:true", { skip: process.platform !== "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "awc-win-run-cmd-"));
  await writeFile(join(directory, "opencode.cmd"), "@echo off\r\necho 1.15.12\r\n");

  const result = runCommand("opencode", ["--version"], {
    platform: "win32",
    env: {
      ...process.env,
      PATH: directory,
      Path: directory,
      PATHEXT: ".COM;.EXE;.BAT;.CMD",
      ComSpec: process.env.ComSpec,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.stdout.trim(), "1.15.12");
  assert.equal(result.awcCommand.via, "cmd-shim");
  assert.equal(result.awcCommand.windowsVerbatimArguments, true);
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
