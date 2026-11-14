import "server-only";

import { PrismaClient } from "@prisma/client";
import { prismaConnectionUrl } from "./connection-url";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const existingClient = globalForPrisma.prisma;

  if (existingClient) {
    return existingClient;
  }

  const client = new PrismaClient({ datasourceUrl: prismaConnectionUrl(process.env.DATABASE_URL) });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}

export function getPrismaClient(): PrismaClient {
  return createPrismaClient();
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    return Reflect.get(client, property, receiver);
  },
});
