import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import { configFileName } from "./configDocument";

export interface ConfigFile {
  path: string;
  name: string;
  text: string | undefined;
}

export async function readConfigFile(root: string): Promise<ConfigFile> {
  const entries = await readdir(root);
  const name = configFileName(entries);
  const file = path.join(root, name);
  return { path: file, name, text: entries.includes(name) ? await readFile(file, "utf8") : undefined };
}
