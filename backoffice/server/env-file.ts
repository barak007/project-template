import { readFile, writeFile } from "node:fs/promises";

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_]*)=/;

/**
 * Rewrites `KEY=value` lines in a dotenv file in place, appending keys the
 * file does not have yet. Creates the file when it is missing.
 */
export async function upsertEnvFileValues(
  filePath: string,
  values: Record<string, string>,
): Promise<void> {
  const current = await readFile(filePath, "utf8").catch(() => "");
  const remaining = new Map(Object.entries(values));
  const lines = (current === "" ? [] : current.split("\n")).map((line) => {
    const key = KEY_LINE.exec(line)?.[1];
    if (key === undefined || !remaining.has(key)) return line;
    const value = remaining.get(key) ?? "";
    remaining.delete(key);
    return `${key}=${value}`;
  });
  while (lines.at(-1) === "") lines.pop();
  for (const [key, value] of remaining) lines.push(`${key}=${value}`);
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}
