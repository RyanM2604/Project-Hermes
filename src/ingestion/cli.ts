import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { pathToFileURL } from "node:url";

import { createCanonicalEventRefreshCoordinator } from "./refresh-canonical-events";
import { buildCliOutput } from "./cli-output";
import { createOpenAIClassifier } from "@/lib/classification/openai-classifier";
import { createPrismaClassificationRepository } from "@/lib/classification/prisma-repository";
import { createPrismaEventPersistenceRepository } from "@/lib/events/persistence";
import type { CanonicalEventRefreshResult, CanonicalEventRefreshOptions } from "./types";

export interface RunCliOptions {
  refresh?: (
    options?: CanonicalEventRefreshOptions,
  ) => Promise<CanonicalEventRefreshResult>;
}

function exitCodeForResult(result: CanonicalEventRefreshResult): number {
  const allSourcesFailed =
    result.sources.length === 0 ||
    result.sources.every((source) => source.status === "failed");
  const persistenceFailed = Boolean(
    result.persistence && result.persistence.failedCount > 0,
  );
  const classificationFailed = Boolean(
    result.classification && result.classification.failedCount > 0,
  );

  return allSourcesFailed || persistenceFailed || classificationFailed ? 1 : 0;
}

export async function runCli(options: RunCliOptions = {}): Promise<number> {
  const refresh = options.refresh ?? getDefaultRefreshCoordinator().refresh;
  const reclassify = process.argv.includes("--reclassify");

  try {
    const result = await refresh({ force: true, reclassify });
    console.log(JSON.stringify(buildCliOutput(result), null, 2));

    return exitCodeForResult(result);
  } catch {
    console.error("Event ingestion failed before a run result could be produced.");
    return 1;
  }
}

async function main(): Promise<void> {
  const { runWorkerCli } = await import("./social/cli");
  process.exitCode = await runWorkerCli();
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && import.meta.url === pathToFileURL(entryPoint).href;
}

let defaultRefreshCoordinator:
  | ReturnType<typeof createCanonicalEventRefreshCoordinator>
  | undefined;

function getDefaultRefreshCoordinator() {
  if (!defaultRefreshCoordinator) {
    loadEnvConfig(process.cwd());
    const prisma = new PrismaClient();
    defaultRefreshCoordinator = createCanonicalEventRefreshCoordinator({
      persistence: createPrismaEventPersistenceRepository(prisma),
      classificationRepository: createPrismaClassificationRepository(prisma),
      classifier: createOpenAIClassifier(),
    });
  }

  return defaultRefreshCoordinator;
}

if (isDirectExecution()) {
  void main().catch(() => {
    console.error("Event ingestion failed before a run result could be produced.");
    process.exitCode = 1;
  });
}
