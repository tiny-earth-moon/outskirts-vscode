import { execFile, ExecFileException } from "node:child_process";
import { currentSearchEnvironment, resolveOnPath } from "./commandPath";
import { parseCheck } from "./configCheck";
import { CheckResult } from "./configMessages";
import { ConfigSchema, parseSchema } from "./configSchema";
import { parseVersion } from "./version";

interface Output {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  error: ExecFileException | null;
}

function run(command: string, args: string[], cwd: string, timeout: number): Promise<Output> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, timeout, shell: false, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      const exitCode = error === null ? 0 : typeof error.code === "number" ? error.code : null;
      resolve({ exitCode, stdout, stderr, error });
    });
  });
}

export interface LoadedSchema {
  schema: ConfigSchema;
  version: string | undefined;
}

const cache = new Map<string, Promise<ConfigSchema>>();

export async function loadSchema(executable: string, cwd: string): Promise<LoadedSchema> {
  const command = resolveOnPath(executable, currentSearchEnvironment());
  const versionOutput = await run(command, ["version"], cwd, 10000);
  const version = versionOutput.exitCode === 0 ? parseVersion(versionOutput.stdout) : undefined;
  const key = `${command}\u0000${version ?? "unknown"}`;
  let schema = cache.get(key);
  if (schema === undefined || version === undefined) {
    schema = fetchSchema(command, cwd, version);
    cache.set(key, schema);
    schema.catch(() => cache.delete(key));
  }
  return { schema: await schema, version };
}

async function fetchSchema(command: string, cwd: string, version: string | undefined): Promise<ConfigSchema> {
  const output = await run(command, ["config", "schema"], cwd, 15000);
  if (output.exitCode !== 0) {
    const detail = output.stderr.trim().split("\n").at(0) ?? output.error?.message ?? "";
    throw new Error(
      `outskirts${version === undefined ? "" : ` ${version}`} did not print its configuration schema (outskirts config schema)` +
        `${detail === "" ? "" : `: ${detail}`}. Update outskirts to edit the configuration here.`,
    );
  }
  return parseSchema(output.stdout);
}

export async function checkConfig(executable: string, root: string, file: string): Promise<CheckResult> {
  let command: string;
  try {
    command = resolveOnPath(executable, currentSearchEnvironment());
  } catch (error) {
    return { state: "unavailable", messages: [error instanceof Error ? error.message : String(error)] };
  }
  const output = await run(command, ["config", "check", "--project-root", root, "--config", file], root, 30000);
  if (output.exitCode === null && output.error !== null) {
    return { state: "unavailable", messages: [output.error.killed === true ? "outskirts config check did not answer in time." : output.error.message] };
  }
  return parseCheck(output.exitCode, `${output.stdout}\n${output.stderr}`, file);
}
