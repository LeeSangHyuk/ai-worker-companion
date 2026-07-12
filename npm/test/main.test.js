import test from "node:test";
import assert from "node:assert/strict";
import { main } from "../cli/main.js";

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
});

test("unknown commands and options return usage errors", async () => {
  const command = await capture(["invalid"]);
  assert.equal(command.code, 2);
  assert.match(command.errors, /Unknown command/);

  const option = await capture(["doctor", "--skip-deps"]);
  assert.equal(option.code, 2);
  assert.match(option.errors, /Unknown option/);
});
