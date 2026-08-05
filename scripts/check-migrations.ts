import { spawnSync } from "node:child_process";

const generate = spawnSync("pnpm", ["db:generate"], { stdio: "inherit" });
if (generate.status !== 0) process.exit(generate.status ?? 1);
const diff = spawnSync("git", ["diff", "--exit-code", "--", "drizzle"], {
  stdio: "inherit",
});
if (diff.status !== 0) {
  console.error(
    "Generated Drizzle migrations are stale; commit the generated changes.",
  );
  process.exit(1);
}
