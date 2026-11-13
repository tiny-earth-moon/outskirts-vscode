import { realpath } from "node:fs/promises";
import { FolderAlias } from "./location";

export async function folderAliases(folders: readonly string[]): Promise<FolderAlias[]> {
  const aliases = await Promise.all(folders.map(async (shown) => ({ real: await realpath(shown), shown })));
  return aliases.filter((alias) => alias.real !== alias.shown);
}
