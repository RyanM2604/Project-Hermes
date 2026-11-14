import { describe, expect, it } from "vitest";
import { prismaConnectionUrl } from "./connection-url";
describe("Prisma transaction pooler configuration", () => {
  it("disables prepared statements on Supabase transaction pooling", () => {
    expect(prismaConnectionUrl("postgresql://user:pass@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require")).toBe("postgresql://user:pass@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true");
  });
  it("preserves direct, session, custom and missing URLs", () => {
    for (const value of [undefined, "postgresql://localhost:5432/test", "postgresql://user:pass@aws-1-us-east-2.pooler.supabase.com:5432/postgres", "postgresql://custom.example:6543/db"]) expect(prismaConnectionUrl(value)).toBe(value);
  });
});
