# Supabase Project Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transfer the complete Hermes database, including Supabase Auth users, password hashes, identities, and session records, from the old Supabase project to the new project without losing data; users will sign in again after cutover.

**Architecture:** Use the official Supabase CLI logical-backup workflow to create role, schema, and data SQL files in an owner-only temporary directory outside Git. Treat the empty target as the failing pre-migration test, restore through the target session pooler in one transaction, then run catalog, row-count, relationship, RLS, Auth, Prisma, and deployed smoke checks before enabling writes.

**Tech Stack:** Supabase CLI 2.90.0, Docker 29.4.1, PostgreSQL `psql`, Prisma 6.19.3, Supabase Auth, Vercel

---

## File Structure

- Create: `scripts/sql/validate-supabase-migration.sql` — read-only structural, relational, RLS, policy, privilege, and aggregate-count validation for the restored target.
- Create at runtime outside Git: `/private/tmp/hermes-supabase-migration.XXXXXX/roles.sql` — generated role dump containing no application row data.
- Create at runtime outside Git: `/private/tmp/hermes-supabase-migration.XXXXXX/schema.sql` — generated database schema dump.
- Create at runtime outside Git: `/private/tmp/hermes-supabase-migration.XXXXXX/data.sql` — generated data dump containing Auth and application data; treat as sensitive.
- Modify locally but never commit: `.env` — replace `DIRECT_URL` with the new project's session-pooler URL on port 5432 after the user supplies it.
- Modify externally during cutover: Supabase Auth settings and Vercel environment variables.

The generated SQL files are operational artifacts, not repository migrations.
They must remain outside the repository and must never be printed, inspected for
row contents, or committed.

## Approval Gates

Execution must pause for explicit user approval before each of these mutations:

1. Editing `.env` or creating the validator file.
2. Disabling production writes and the scheduled ingestion job.
3. Creating the local temporary backup files.
4. Restoring into the new Supabase database.
5. Changing Vercel environment variables and deploying.
6. Deleting the temporary backup or changing the old project.

Read-only connection tests, schema inventory, and aggregate counts do not alter
either project.

### Task 1: Establish the failing target validation

**Files:**
- Create: `scripts/sql/validate-supabase-migration.sql`
- Modify locally: `.env`

- [ ] **Step 1: Obtain the new session-pooler connection string**

In the new Supabase project, open **Connect**, select **Session pooler**, and
copy the port-5432 connection string. After explicit approval, replace the
unreachable direct connection in `.env`:

```dotenv
DIRECT_URL="the exact new-project Session pooler URI from Supabase Connect"
```

Do not paste the URI into chat, the plan, source code, or command output.

- [ ] **Step 2: Validate source and target connection shape without printing secrets**

Run:

```bash
set -a
source .env
set +a
node -e '
const keys = ["OLD_DATABASE_URL", "DIRECT_URL"];
const refs = [];
for (const key of keys) {
  const raw = process.env[key];
  if (!raw) throw new Error(`${key} is missing`);
  const url = new URL(raw);
  if (url.protocol !== "postgresql:") throw new Error(`${key} must use postgresql`);
  if (url.port !== "5432") throw new Error(`${key} must use session port 5432`);
  if (!url.hostname.endsWith(".pooler.supabase.com")) {
    throw new Error(`${key} must use the Supabase session pooler`);
  }
  const ref = url.username.split(".")[1];
  if (!ref) throw new Error(`${key} username must contain a project ref`);
  refs.push(ref);
  console.log(`${key}: project=${ref}, host=${url.hostname}, port=${url.port}`);
}
if (refs[0] === refs[1]) throw new Error("source and target project refs match");
'
```

Expected: two sanitized, different project references and port `5432`; no
passwords are printed.

- [ ] **Step 3: Write the read-only database validator**

Create `scripts/sql/validate-supabase-migration.sql` with exactly:

```sql
\set ON_ERROR_STOP on

do $migration_validation$
declare
  relation_name text;
  constraint_name text;
  index_name text;
  actual_count bigint;
begin
  foreach relation_name in array array[
    'auth.users',
    'auth.identities',
    'auth.sessions',
    'public._prisma_migrations',
    'public.events',
    'public.event_classifications',
    'public.saved_events',
    'public.event_rsvps',
    'public.interactions'
  ] loop
    if to_regclass(relation_name) is null then
      raise exception 'missing relation: %', relation_name;
    end if;
  end loop;

  foreach constraint_name in array array[
    'events_pkey',
    'event_classifications_pkey',
    'event_classifications_confidence_check',
    'event_classifications_event_id_fkey',
    'saved_events_pkey',
    'saved_events_user_id_event_id_key',
    'saved_events_user_id_fkey',
    'event_rsvps_pkey',
    'event_rsvps_status_check',
    'event_rsvps_user_id_event_id_key',
    'event_rsvps_user_id_fkey',
    'interactions_pkey',
    'interactions_action_check',
    'interactions_actor_check',
    'interactions_user_id_fkey'
  ] loop
    if not exists (
      select 1
      from pg_constraint
      where conname = constraint_name
        and connamespace = 'public'::regnamespace
    ) then
      raise exception 'missing constraint: %', constraint_name;
    end if;
  end loop;

  foreach index_name in array array[
    'events_source_fingerprint_key',
    'events_start_time_idx',
    'events_classification_status_idx',
    'event_classifications_primary_tag_idx',
    'interactions_user_id_idx',
    'interactions_event_id_idx',
    'interactions_action_idx',
    'interactions_created_at_idx'
  ] loop
    if to_regclass('public.' || index_name) is null then
      raise exception 'missing index: %', index_name;
    end if;
  end loop;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.saved_events'::regclass
  ) then
    raise exception 'RLS is disabled on public.saved_events';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.event_rsvps'::regclass
  ) then
    raise exception 'RLS is disabled on public.event_rsvps';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.interactions'::regclass
  ) then
    raise exception 'RLS is disabled on public.interactions';
  end if;

  select count(*) into actual_count
  from pg_policies
  where schemaname = 'public' and tablename = 'saved_events';
  if actual_count <> 3 then
    raise exception 'expected 3 saved_events policies, found %', actual_count;
  end if;

  select count(*) into actual_count
  from pg_policies
  where schemaname = 'public' and tablename = 'event_rsvps';
  if actual_count <> 3 then
    raise exception 'expected 3 event_rsvps policies, found %', actual_count;
  end if;

  select count(*) into actual_count
  from pg_policies
  where schemaname = 'public' and tablename = 'interactions';
  if actual_count <> 2 then
    raise exception 'expected 2 interactions policies, found %', actual_count;
  end if;

  if has_table_privilege('anon', 'public.saved_events', 'SELECT') then
    raise exception 'anon unexpectedly has SELECT on saved_events';
  end if;
  if has_table_privilege('anon', 'public.event_rsvps', 'SELECT') then
    raise exception 'anon unexpectedly has SELECT on event_rsvps';
  end if;
  if not has_table_privilege('anon', 'public.interactions', 'INSERT') then
    raise exception 'anon is missing INSERT on interactions';
  end if;
  if not has_table_privilege('authenticated', 'public.saved_events', 'SELECT,INSERT,DELETE') then
    raise exception 'authenticated is missing saved_events privileges';
  end if;
  if not has_table_privilege('authenticated', 'public.event_rsvps', 'SELECT,INSERT,UPDATE') then
    raise exception 'authenticated is missing event_rsvps privileges';
  end if;

  select count(*) into actual_count
  from public.saved_events child
  left join auth.users parent on parent.id = child.user_id
  where parent.id is null;
  if actual_count <> 0 then
    raise exception 'saved_events contains % orphaned users', actual_count;
  end if;

  select count(*) into actual_count
  from public.event_rsvps child
  left join auth.users parent on parent.id = child.user_id
  where parent.id is null;
  if actual_count <> 0 then
    raise exception 'event_rsvps contains % orphaned users', actual_count;
  end if;

  select count(*) into actual_count
  from public.interactions child
  left join auth.users parent on parent.id = child.user_id
  where child.user_id is not null and parent.id is null;
  if actual_count <> 0 then
    raise exception 'interactions contains % orphaned users', actual_count;
  end if;

  select count(*) into actual_count
  from public.event_classifications child
  left join public.events parent on parent.id = child.event_id
  where parent.id is null;
  if actual_count <> 0 then
    raise exception 'event_classifications contains % orphaned events', actual_count;
  end if;
end
$migration_validation$;

select json_build_object(
  'auth_users', (select count(*) from auth.users),
  'auth_identities', (select count(*) from auth.identities),
  'auth_sessions', (select count(*) from auth.sessions),
  'prisma_migrations', (select count(*) from public._prisma_migrations),
  'events', (select count(*) from public.events),
  'event_classifications', (select count(*) from public.event_classifications),
  'saved_events', (select count(*) from public.saved_events),
  'event_rsvps', (select count(*) from public.event_rsvps),
  'interactions', (select count(*) from public.interactions)
) as migration_counts;
```

- [ ] **Step 4: Run the validator against the old source**

Run:

```bash
set -a
source .env
set +a
psql "$OLD_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -f scripts/sql/validate-supabase-migration.sql
```

Expected: the `DO` block succeeds and the JSON count object contains the source
counts. If current counts have increased since design time, those newer values
become the final baseline after maintenance begins.

- [ ] **Step 5: Run the validator against the empty target and verify RED**

Run:

```bash
psql "$DIRECT_URL" -X -v ON_ERROR_STOP=1 \
  -f scripts/sql/validate-supabase-migration.sql
```

Expected: non-zero exit with `missing relation: public._prisma_migrations` or
another missing Hermes relation. This proves the validator detects the target's
unmigrated state.

- [ ] **Step 6: Commit the validator only after explicit commit approval**

```bash
git add scripts/sql/validate-supabase-migration.sql
git commit -m "test: add Supabase migration validator"
```

Do not stage `.env`, temporary dumps, or unrelated working-tree changes.

### Task 2: Confirm Auth configuration and freeze source writes

**Files:**
- Verify externally: new Supabase Auth/API settings
- Modify externally: production availability and Vercel Cron state

- [ ] **Step 1: Keep the target JWT configuration unchanged**

Do not copy the old JWT secret and do not add application code for the old
project's cookie namespace. The three copied Auth session records remain part
of the database transfer, but users are expected to sign in again.

- [ ] **Step 2: Verify the target Auth credentials**

Use the target anon and service-role keys already stored in local `.env`.
Expected: the target Auth health endpoint returns HTTP 200 with the anon key,
and the admin users endpoint returns HTTP 200 with the service-role key.

- [ ] **Step 3: Compare project-level Auth configuration**

In the dashboards, compare enabled providers, Site URL, redirect URLs, email
confirmation behavior, SMTP configuration, and email templates. Apply any
required target changes only after describing them and obtaining approval.

- [ ] **Step 4: Request approval to begin the maintenance window**

The maintenance action must prevent sign-ups, saves, RSVPs, interactions, and
the `/api/cron/refresh-events` job from writing to the old project. Disable the
Vercel cron or keep the window away from its `0 13 * * *` schedule, and make the
deployed application read-only or unavailable.

- [ ] **Step 5: Capture the final source aggregate counts**

Run the validator against `OLD_DATABASE_URL` again and retain only the JSON
count object in the operator notes. Do not record user rows.

- [ ] **Step 6: Verify the source stayed frozen**

Wait only as long as needed to repeat the count query once. Expected: identical
JSON. If counts changed, the maintenance mechanism is incomplete; stop and fix
the freeze before taking a backup.

### Task 3: Create the secure logical backup

**Files:**
- Create outside Git: `/private/tmp/hermes-supabase-migration.XXXXXX/roles.sql`
- Create outside Git: `/private/tmp/hermes-supabase-migration.XXXXXX/schema.sql`
- Create outside Git: `/private/tmp/hermes-supabase-migration.XXXXXX/data.sql`

- [ ] **Step 1: Request approval to create sensitive temporary backup files**

Describe the exact target as a new `mktemp` directory under `/private/tmp`, not
the repository and not a broad directory.

- [ ] **Step 2: Create the owner-only temporary directory**

Run:

```bash
MIGRATION_DIR="$(mktemp -d /private/tmp/hermes-supabase-migration.XXXXXX)"
chmod 700 "$MIGRATION_DIR"
printf 'Migration directory created: %s\n' "$MIGRATION_DIR"
```

Expected: one new, explicit directory path under `/private/tmp`.

- [ ] **Step 3: Export roles**

```bash
supabase db dump --db-url "$OLD_DATABASE_URL" \
  --file "$MIGRATION_DIR/roles.sql" \
  --role-only
```

Expected: exit 0 and non-empty `roles.sql`.

- [ ] **Step 4: Export schema**

```bash
supabase db dump --db-url "$OLD_DATABASE_URL" \
  --file "$MIGRATION_DIR/schema.sql"
```

Expected: exit 0 and non-empty `schema.sql`.

- [ ] **Step 5: Export data**

```bash
supabase db dump --db-url "$OLD_DATABASE_URL" \
  --file "$MIGRATION_DIR/data.sql" \
  --use-copy \
  --data-only \
  --exclude storage.buckets_vectors \
  --exclude storage.vector_indexes
```

Expected: exit 0 and non-empty `data.sql`.

- [ ] **Step 6: Lock down and verify artifacts without printing them**

```bash
chmod 600 "$MIGRATION_DIR/roles.sql" \
  "$MIGRATION_DIR/schema.sql" \
  "$MIGRATION_DIR/data.sql"
test -s "$MIGRATION_DIR/roles.sql"
test -s "$MIGRATION_DIR/schema.sql"
test -s "$MIGRATION_DIR/data.sql"
stat -f '%Sp %N' "$MIGRATION_DIR" "$MIGRATION_DIR"/*.sql
```

Expected: directory permissions `drwx------`, file permissions `-rw-------`,
and all three tests exit 0.

- [ ] **Step 7: Recheck the frozen source counts**

Run the validator again. Expected: the count JSON is unchanged from the final
baseline. If it changed, discard neither data nor the old project; stop and
take a new snapshot only after the write source is identified.

### Task 4: Restore the target atomically

**Files:**
- Read: `$MIGRATION_DIR/roles.sql`
- Read: `$MIGRATION_DIR/schema.sql`
- Read: `$MIGRATION_DIR/data.sql`
- Modify externally: new Supabase database

- [ ] **Step 1: Verify the target is still empty**

Run:

```bash
psql "$DIRECT_URL" -X -v ON_ERROR_STOP=1 -Atc \
  "select count(*) from pg_tables where schemaname = 'public'; select count(*) from auth.users;"
```

Expected: no Hermes application tables and zero Auth users. If the target is no
longer empty, stop; do not drop or overwrite anything without a new destructive
action approval.

- [ ] **Step 2: Request explicit approval for the restore**

State that the exact target is the new Supabase project reference printed by
the sanitized preflight and that the operation will create/replace database
objects and insert Auth and application data.

- [ ] **Step 3: Restore in one transaction**

Run:

```bash
psql \
  --no-psqlrc \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$MIGRATION_DIR/roles.sql" \
  --file "$MIGRATION_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$MIGRATION_DIR/data.sql" \
  --dbname "$DIRECT_URL"
```

Expected: exit 0. Any SQL error aborts the transaction. Do not retry by applying
individual statements or continue to cutover after a partial result.

### Task 5: Verify GREEN against the restored target

**Files:**
- Test: `scripts/sql/validate-supabase-migration.sql`

- [ ] **Step 1: Run the structural validator against the target**

```bash
psql "$DIRECT_URL" -X -v ON_ERROR_STOP=1 \
  -f scripts/sql/validate-supabase-migration.sql
```

Expected: exit 0 and a JSON aggregate-count object.

- [ ] **Step 2: Compare aggregate counts directly**

```bash
COUNT_SQL="select json_build_object(
  'auth_users',(select count(*) from auth.users),
  'auth_identities',(select count(*) from auth.identities),
  'auth_sessions',(select count(*) from auth.sessions),
  'prisma_migrations',(select count(*) from public._prisma_migrations),
  'events',(select count(*) from public.events),
  'event_classifications',(select count(*) from public.event_classifications),
  'saved_events',(select count(*) from public.saved_events),
  'event_rsvps',(select count(*) from public.event_rsvps),
  'interactions',(select count(*) from public.interactions)
)::text;"
SOURCE_COUNTS="$(psql "$OLD_DATABASE_URL" -X -Atc "$COUNT_SQL")"
TARGET_COUNTS="$(psql "$DIRECT_URL" -X -Atc "$COUNT_SQL")"
test "$SOURCE_COUNTS" = "$TARGET_COUNTS"
printf '%s\n' "$TARGET_COUNTS"
```

Expected: `test` exits 0. The JSON may exceed the design-time counts only if
the final frozen source baseline also increased by the same amounts.

- [ ] **Step 3: Verify Prisma runtime access through the transaction pooler**

```bash
set -a
source .env
set +a
npx tsx -e '
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const result = await prisma.$transaction(async (tx) => ({
  events: await tx.event.count(),
  classifications: await tx.eventClassification.count(),
  interactions: await tx.interaction.count(),
}));
console.log(JSON.stringify(result));
await prisma.$disconnect();
'
```

Expected: the three counts match the target validation and the transaction
completes without prepared-statement or pooler errors.

- [ ] **Step 4: Verify Supabase REST and Auth with the target keys**

```bash
printf 'auth=' 
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health"
printf 'rest=' 
curl -sS -o /dev/null -w '%{http_code}\n' \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"
```

Expected: `auth=200` and `rest=200`.

- [ ] **Step 5: Run repository verification**

```bash
npm test
npm run lint
npm run build
```

Expected: all tests pass, lint exits 0, and the production build succeeds while
using the restored target database.

### Task 6: Cut over Vercel and run deployed smoke tests

**Files:**
- Modify externally: Vercel environment variables and deployment

- [ ] **Step 1: Request explicit cutover approval**

List the Vercel variables to change without their values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` using transaction port 6543
- `DIRECT_URL` using session port 5432

Confirm the old values are retained securely for rollback.

- [ ] **Step 2: Update Vercel variables and redeploy**

Use the Vercel dashboard or authenticated CLI without printing secret values.
Redeploy only after all five variables are updated for the production
environment.

- [ ] **Step 3: Verify the deployed read paths**

Confirm:

1. `/events` returns the restored future events.
2. An event detail page loads its classification and going count.
3. The browser console and server logs contain no Prisma, PostgREST, or Auth
   errors.

- [ ] **Step 4: Verify authentication after the intentional session reset**

Expected: an old authenticated browser session is not relied upon after the
project-ref change. Perform a fresh sign-in using an existing account and prove
that the migrated password hash, identity, and stable user ID work against the
new project.

- [ ] **Step 5: Verify writes on one controlled record**

With a test account and an existing event:

1. Save, verify, then unsave the event.
2. Change RSVP status, verify it, then restore the previous status.
3. Trigger one interaction and confirm its aggregate count increases by one.

These are external writes and require explicit smoke-test approval before they
are performed.

- [ ] **Step 6: Verify ingestion**

Invoke the protected refresh endpoint or run `npm run ingest:events` only after
explicit approval because it fetches external data, writes events and
classifications, and may call OpenAI. Confirm the run completes and `/events`
still reads the resulting canonical data.

- [ ] **Step 7: Re-enable normal traffic and scheduling**

Restore write access and the Vercel cron only after all read, Auth, write, and
ingestion checks pass.

### Task 7: Retain rollback assets, then clean up separately

**Files:**
- Potentially delete after separate approval: `$MIGRATION_DIR`
- Potentially modify later after separate approval: old Supabase project

- [ ] **Step 1: Record the successful migration evidence**

Report only aggregate counts, check results, deployment identifier, and smoke
test status. Do not store secrets or row-level Auth data.

- [ ] **Step 2: Keep the old project and temporary dump during observation**

Do not delete, pause, reset, or modify the old project. Do not delete the
temporary dump until the user accepts the new deployment.

- [ ] **Step 3: Request cleanup approval**

Identify the exact temporary directory and explain that deletion is permanent.
Request a separate approval before deleting it. Old-project retirement is a
different destructive decision and requires its own approval.

- [ ] **Step 4: Delete only the approved temporary directory**

After approval, remove the exact validated `$MIGRATION_DIR` path and report that
the sensitive local backup is no longer recoverable from that directory.

## Rollback Procedure

If validation fails before cutover, leave Vercel pointed to the old project and
keep the maintenance window active only as long as needed to diagnose or abort.

If deployed smoke tests fail after cutover:

1. Reapply the retained old Supabase URL, keys, `DATABASE_URL`, and `DIRECT_URL`
   to Vercel.
2. Redeploy the last known-good application against the unchanged old project.
3. Confirm Auth and `/events` recover.
4. Reopen old-project writes.
5. Preserve the failed target and dump for read-only diagnosis; do not clean or
   retry without a new plan and approval.

Rollback changes external systems and therefore requires explicit approval at
the time it is needed, unless the user has already granted a bounded emergency
rollback authorization.
