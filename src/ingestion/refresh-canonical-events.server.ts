import "server-only";

import { prisma } from "@/lib/db/prisma";

import {
  createDefaultCanonicalEventRefreshCoordinator,
} from "./refresh-canonical-events";

export const canonicalEventRefreshCoordinator =
  createDefaultCanonicalEventRefreshCoordinator(prisma);
