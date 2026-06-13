import { buildCliOutput } from "./cli-output";
import { runIngestion } from "./run-ingestion";

async function main(): Promise<void> {
  const result = await runIngestion();

  console.log(JSON.stringify(buildCliOutput(result), null, 2));

  if (result.sources.every((source) => source.status === "failed")) {
    process.exitCode = 1;
  }
}

void main().catch(() => {
  console.error("Event ingestion failed before a run result could be produced.");
  process.exitCode = 1;
});
