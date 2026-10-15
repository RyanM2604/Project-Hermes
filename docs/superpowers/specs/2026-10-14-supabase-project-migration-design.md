# Supabase Project Migration Design

## Goal

Move Hermes from the existing Supabase project to the new empty Supabase
project without losing authentication accounts, password hashes, active
sessions, canonical event data, classifications, saves, RSVPs, or interaction
history.

The migration must be reversible until the new deployment passes its
post-restore checks. Database credentials, API keys, password hashes, and
database dumps must never be committed to Git.

## Confirmed Source State

The old project is reachable through `OLD_DATABASE_URL` using Supavisor session
mode on port 5432. A read-only inventory confirmed these source counts:

| Relation | Rows |
| --- | ---: |
| `auth.users` | 105 |
| `auth.identities` | 105 |
| `auth.sessions` | 3 |
| `public.events` | 87 |
| `public.event_classifications` | 87 |
| `public.saved_events` | 4 |
| `public.event_rsvps` | 205 |
| `public.interactions` | 955 |

The source also contains `public._prisma_migrations`. The old project has no
Storage buckets, so this migration does not include Storage objects.

The target project's transaction pooler, REST API, and Auth API are reachable.
Its managed Auth schema is empty, and it has no application tables. The direct
database hostname is not reachable from the local network, so migration work
will use the target's Supavisor session pooler on port 5432.

## Chosen Approach

Use Supabase's supported logical backup and restore procedure. The Supabase CLI
will produce separate role, schema, and data SQL files from the old database.
Those files will be restored to the new database with `psql` in a single
transaction and with replication-role handling during the data phase.

This approach is preferred over a custom table-copy query because Hermes data
depends on Supabase-managed Auth tables. A supported full logical dump preserves
users, password hashes, identities, sessions, constraints, grants, policies,
and application data together.

The dump files will live in a newly created, permission-restricted temporary
directory outside the repository. They contain authentication data and must
not be added to Git, copied into project documentation, or printed to logs.
They will be retained only until the user confirms that the migration is
successful, after which deletion will require explicit approval.

## Rejected Alternatives

### Custom application-schema SQL plus Auth Admin API

This could recreate the public tables and create user accounts, but it would
not safely preserve existing password hashes and active sessions. It also risks
changing user IDs, which would break the foreign keys and ownership semantics
of saved events, RSVPs, and authenticated interactions.

### Cross-project `dblink` or foreign data wrappers

This would require exposing source credentials to the target database and
performing custom writes into Supabase-managed schemas. It increases operational
risk without improving recoverability.

### Dashboard physical restore

A physical restore can be appropriate when the old project has eligible paid
backups and the dashboard supports restoring them to another project. The
logical CLI workflow is selected because it is available with the confirmed
local tooling and can be inspected and verified before cutover.

## Migration Artifacts

The implementation will create:

- A repository migration runbook or script containing commands and validation
  logic but no credentials or database contents.
- A permission-restricted temporary directory containing `roles.sql`,
  `schema.sql`, and `data.sql` during the migration.
- A validation report containing only schema object names, aggregate counts,
  constraint results, and HTTP status codes. It must not contain user records,
  emails, password hashes, tokens, or keys.

The existing Prisma and Supabase migrations remain the source-controlled
description of the Hermes application schema. The full generated dump is an
operational transfer artifact, not a new checked-in application migration.

## Connection Model

- `OLD_DATABASE_URL`: old project session-pooler URL on port 5432; source only.
- Target migration URL: new project session-pooler URL on port 5432; restore
  target only.
- `DATABASE_URL`: new project transaction-pooler URL on port 6543; deployed
  Prisma runtime.
- `DIRECT_URL`: new project session-pooler URL on port 5432 after cutover;
  Prisma migrations and administrative operations.

The implementation must compare sanitized source and target project references
before any dump or restore. It must abort if they are missing or equal. It must
never print URL passwords.

## Session Preservation

The user chose to preserve the three active sessions. Before the database
restore, the old project's JWT secret will be configured on the new project.
Changing the target JWT secret regenerates its anon and service-role API keys,
so the new keys must be collected only after this change and then propagated to
local and Vercel environment variables during cutover.

The database dump transfers Auth users, identities, refresh-token state, and
sessions. Reusing the signing secret allows tokens issued by the old project to
remain verifiable by the new project. Auth provider settings, redirect URLs,
email templates, and other project-level configuration are not guaranteed to
be contained in the database dump and must be compared separately before
cutover.

## Migration Sequence

### 1. Preflight

1. Confirm the old project remains healthy and read-only inventory counts still
   match the baseline.
2. Confirm the target project is the intended empty project.
3. Confirm source and target session-pooler connections use port 5432.
4. Confirm Supabase CLI, Docker, and `psql` are available.
5. Create a permission-restricted temporary directory outside the repository.
6. Confirm enough local space exists for the logical dump.
7. Compare old and new project-level Auth configuration.

Preflight is read-only except for creating the local temporary directory. No
target database write occurs during this phase.

### 2. Session Configuration

1. Copy the old JWT secret to the new project's Auth/API settings.
2. Record the newly generated target anon and service-role keys in the approved
   secret-management locations.
3. Verify the new Auth health and admin endpoints with the regenerated keys.

Secrets must be moved through the Supabase and Vercel dashboards or local
environment files and must not be pasted into source files or command output.

### 3. Maintenance Window

1. Prevent sign-ups and application writes against the old project.
2. Keep the old deployment available only if it is guaranteed not to create
   database writes.
3. Record the final source counts immediately before the dump.

The maintenance window prevents users, RSVPs, saves, or interactions from being
created after the snapshot and omitted from the new project.

### 4. Backup

Use the Supabase CLI to export roles, schema, and data from
`OLD_DATABASE_URL`. The data dump will use COPY format and the exclusions
recommended by Supabase for vector-backed Storage tables. Command output must
be checked for errors before continuing.

The backup phase must not modify the old project.

### 5. Restore

Before restoring, re-check that the target contains no Hermes data. Restore the
role, schema, and data files to the target session-pooler URL using one `psql`
transaction with `ON_ERROR_STOP=1`. Set `session_replication_role = replica`
only for the data load as prescribed by the supported restore procedure.

Any restore error aborts and rolls back the entire database transaction. The
implementation must not patch around individual restore failures or continue
to cutover with a partially restored database.

### 6. Database Validation

Validation must confirm:

- All expected public and Auth relations exist.
- Source and target row counts match for every relation in the baseline table.
- `public._prisma_migrations` history is present.
- No saved event, RSVP, or authenticated interaction references a missing Auth
  user.
- Every classification references an existing event.
- Primary keys, unique constraints, foreign keys, checks, indexes, grants, RLS
  enablement, and policies match the source.
- Prisma can read events and classifications and can complete a transaction.
- Supabase service-role reads succeed.
- Auth health and admin endpoints authenticate with the regenerated target
  keys.

Validation is read-only. Any mismatch blocks cutover.

### 7. Application Cutover

1. Update local and Vercel variables to the new Supabase URL, regenerated anon
   and service-role keys, transaction-pooler `DATABASE_URL`, and session-pooler
   `DIRECT_URL`.
2. Redeploy Hermes.
3. Verify login/session behavior, the events list, event details, save, RSVP,
   interaction logging, and ingestion against the new project.
4. Reopen writes only after all checks pass.

Changing Vercel environment variables and deploying are external mutations and
require explicit user approval immediately before execution.

## Error Handling and Rollback

- A backup failure leaves both projects unchanged and blocks the restore.
- A restore failure rolls back the target transaction and blocks validation.
- A validation failure leaves production pointed at the old project.
- A post-deployment failure is rolled back by restoring the old Vercel
  environment variables and redeploying against the unchanged old project.
- The old project must not be deleted, reset, paused, or modified until the user
  accepts the new deployment and separately approves cleanup.

Because the new target is currently empty, retrying a failed restore may first
require recreating or cleaning the target. Any destructive cleanup requires a
separate explicit approval after its exact scope is identified.

## Security and Privacy

- Never print or commit database URLs, JWT secrets, API keys, Auth records,
  password hashes, refresh tokens, or session tokens.
- Keep dump files outside the repository with owner-only filesystem
  permissions.
- Report only aggregate counts and schema metadata.
- Do not send Auth or user data to OpenAI or any other external service.
- Do not use the transaction pooler for backup or restore.
- Do not delete the temporary dump or old project until cleanup is explicitly
  approved.

## Acceptance Criteria

The migration is successful only when:

1. Every baseline source count matches the target count.
2. Schema, constraint, index, grant, and RLS comparisons pass.
3. Existing user IDs, identities, password hashes, and session records are
   preserved.
4. Hermes reads the 87 canonical events and their classifications from the new
   database.
5. Saves, RSVPs, and interaction history remain associated with the same user
   IDs.
6. Authentication, save, RSVP, interaction logging, and ingestion smoke tests
   pass on the deployed application.
7. The old project remains available as a rollback target.
8. No secret or data dump enters Git history.

## Execution Boundary

Creating and committing this design specification does not authorize taking a
backup, changing the target JWT secret, entering maintenance mode, restoring a
database, changing Vercel variables, deploying, deleting temporary files, or
modifying either Supabase project. Each external mutation will be described and
explicitly approved before execution.
