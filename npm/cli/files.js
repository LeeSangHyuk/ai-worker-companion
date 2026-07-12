import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function writeAtomic(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.awc-tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, path);
}

export async function writeJson(path, value) {
  await writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function parseJsonFile(path, fallback = {}) {
  const content = await readOptional(path);
  if (content === null) return structuredClone(fallback);
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Refusing to modify invalid JSON at ${path}: ${error.message}`);
  }
}

export async function restore(path, previous) {
  if (previous === null) await rm(path, { force: true });
  else await writeAtomic(path, previous);
}
