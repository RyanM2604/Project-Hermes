/** Supavisor transaction pooling does not retain Prisma prepared statements. */
export function prismaConnectionUrl(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") {
      url.searchParams.set("pgbouncer", "true");
      return url.toString();
    }
  } catch { /* Prisma reports malformed connection configuration itself. */ }
  return value;
}
