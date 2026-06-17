import { loadEnvConfig } from "@next/env";
import { pathToFileURL } from "node:url";

import type { RsvpStatus } from "@/lib/events/rsvp-event";

const DEFAULT_USER_COUNT = 100;
const DEFAULT_RSVP_COUNT = 200;
const DEFAULT_PASSWORD = "UWaterlooSeed!2026";
const AUTH_USERS_PAGE_SIZE = 100;
const EVENTS_PAGE_SIZE = 100;
const RSVP_BATCH_SIZE = 100;

interface SeedUserInput {
  email: string;
  displayName: string;
  password: string;
}

interface AuthUserRecord {
  id: string;
  email: string | null;
}

interface SeedRsvpRow {
  userId: string;
  eventId: string;
  status: RsvpStatus;
  updatedAt: string;
}

interface BuildSeedUsersOptions {
  count?: number;
  baseEmailLocalPart?: string;
  domain?: string;
  displayNamePrefix?: string;
  password?: string;
}

interface BuildSeedRsvpsOptions {
  count?: number;
  now?: () => Date;
  rng?: () => number;
}

interface SupabaseConfig {
  baseUrl: string;
  serviceRoleKey: string;
}

interface SeedRosterEntry {
  name: string;
  email: string;
}

const rsvpStatusWeights: Array<{ status: RsvpStatus; weight: number }> = [
  { status: "going", weight: 0.55 },
  { status: "interested", weight: 0.3 },
  { status: "cancelled", weight: 0.15 },
];

const UWATERLOO_SEED_ROSTER: SeedRosterEntry[] = [
  { name: "Aarav Patel", email: "apatel@uwaterloo.invalid" },
  { name: "Maya Chen", email: "mchen@uwaterloo.invalid" },
  { name: "Ethan Wong", email: "ewong@uwaterloo.invalid" },
  { name: "Priya Sharma", email: "psharma@uwaterloo.invalid" },
  { name: "Liam Thompson", email: "lthompson@uwaterloo.invalid" },
  { name: "Sophia Nguyen", email: "snguyen@uwaterloo.invalid" },
  { name: "Daniel Kim", email: "dkim@uwaterloo.invalid" },
  { name: "Anika Gupta", email: "agupta@uwaterloo.invalid" },
  { name: "Noah Miller", email: "nmiller@uwaterloo.invalid" },
  { name: "Emily Zhang", email: "ezhang@uwaterloo.invalid" },
  { name: "Lucas Brown", email: "lbrown@uwaterloo.invalid" },
  { name: "Zara Ali", email: "zali@uwaterloo.invalid" },
  { name: "Benjamin Lee", email: "blee@uwaterloo.invalid" },
  { name: "Kavya Rao", email: "krao@uwaterloo.invalid" },
  { name: "Olivia Wilson", email: "owilson@uwaterloo.invalid" },
  { name: "Ryan Singh", email: "rsingh@uwaterloo.invalid" },
  { name: "Chloe Martin", email: "cmartin@uwaterloo.invalid" },
  { name: "Arjun Mehta", email: "amehta@uwaterloo.invalid" },
  { name: "Emma Davis", email: "edavis@uwaterloo.invalid" },
  { name: "Nathan Li", email: "nli@uwaterloo.invalid" },
  { name: "Isabella Garcia", email: "igarcia@uwaterloo.invalid" },
  { name: "Rohan Kapoor", email: "rkapoor@uwaterloo.invalid" },
  { name: "James Anderson", email: "janderson@uwaterloo.invalid" },
  { name: "Hannah Liu", email: "hliu@uwaterloo.invalid" },
  { name: "Michael Robinson", email: "mrobinson@uwaterloo.invalid" },
  { name: "Sana Khan", email: "skhan@uwaterloo.invalid" },
  { name: "Matthew Clark", email: "mclark@uwaterloo.invalid" },
  { name: "Nina Shah", email: "nshah@uwaterloo.invalid" },
  { name: "Alexander Young", email: "ayoung@uwaterloo.invalid" },
  { name: "Grace Wu", email: "gwu@uwaterloo.invalid" },
  { name: "Jacob Hall", email: "jhall@uwaterloo.invalid" },
  { name: "Meera Iyer", email: "miyer@uwaterloo.invalid" },
  { name: "Victoria Lewis", email: "vlewis@uwaterloo.invalid" },
  { name: "Aditya Nair", email: "anair@uwaterloo.invalid" },
  { name: "Joshua Walker", email: "jwalker@uwaterloo.invalid" },
  { name: "Aisha Ahmed", email: "aahmed@uwaterloo.invalid" },
  { name: "Andrew Scott", email: "ascott@uwaterloo.invalid" },
  { name: "Tara Desai", email: "tdesai@uwaterloo.invalid" },
  { name: "William Harris", email: "wharris@uwaterloo.invalid" },
  { name: "Serena Lin", email: "slin@uwaterloo.invalid" },
  { name: "David Moore", email: "dmoore@uwaterloo.invalid" },
  { name: "Ishan Malhotra", email: "imalhotra@uwaterloo.invalid" },
  { name: "Abigail Taylor", email: "ataylor@uwaterloo.invalid" },
  { name: "Kevin Zhou", email: "kzhou@uwaterloo.invalid" },
  { name: "Lily Campbell", email: "lcampbell@uwaterloo.invalid" },
  { name: "Omar Hassan", email: "ohassan@uwaterloo.invalid" },
  { name: "Christopher Allen", email: "callen@uwaterloo.invalid" },
  { name: "Diya Menon", email: "dmenon@uwaterloo.invalid" },
  { name: "Natalie King", email: "nking@uwaterloo.invalid" },
  { name: "Samir Choudhury", email: "schoudhury@uwaterloo.invalid" },
  { name: "Ella Wright", email: "ewright@uwaterloo.invalid" },
  { name: "Jason Yu", email: "jyu@uwaterloo.invalid" },
  { name: "Madison Green", email: "mgreen@uwaterloo.invalid" },
  { name: "Neha Bansal", email: "nbansal@uwaterloo.invalid" },
  { name: "Anthony Baker", email: "abaker@uwaterloo.invalid" },
  { name: "Fatima Siddiqui", email: "fsiddiqui@uwaterloo.invalid" },
  { name: "Thomas Adams", email: "tadams@uwaterloo.invalid" },
  { name: "Claire Morgan", email: "cmorgan@uwaterloo.invalid" },
  { name: "Dev Patel", email: "dpatel@uwaterloo.invalid" },
  { name: "Audrey Chen", email: "achen@uwaterloo.invalid" },
  { name: "Henry Mitchell", email: "hmitchell@uwaterloo.invalid" },
  { name: "Leila Rahman", email: "lrahman@uwaterloo.invalid" },
  { name: "Dylan Carter", email: "dcarter@uwaterloo.invalid" },
  { name: "Simran Kaur", email: "skaur@uwaterloo.invalid" },
  { name: "Sarah Phillips", email: "sphillips@uwaterloo.invalid" },
  { name: "Harsh Verma", email: "hverma@uwaterloo.invalid" },
  { name: "Isaac Evans", email: "ievans@uwaterloo.invalid" },
  { name: "Mina Park", email: "mpark@uwaterloo.invalid" },
  { name: "Owen Turner", email: "oturner@uwaterloo.invalid" },
  { name: "Nikhil Joshi", email: "njoshi@uwaterloo.invalid" },
  { name: "Julia Parker", email: "jparker@uwaterloo.invalid" },
  { name: "Marcus Hill", email: "mhill@uwaterloo.invalid" },
  { name: "Riya Shah", email: "rshah@uwaterloo.invalid" },
  { name: "Brandon Collins", email: "bcollins@uwaterloo.invalid" },
  { name: "Ashley Rivera", email: "arivera@uwaterloo.invalid" },
  { name: "Vedant Kulkarni", email: "vkulkarni@uwaterloo.invalid" },
  { name: "Lauren Edwards", email: "ledwards@uwaterloo.invalid" },
  { name: "Yuna Choi", email: "ychoi@uwaterloo.invalid" },
  { name: "Gabriel Stewart", email: "gstewart@uwaterloo.invalid" },
  { name: "Amara Johnson", email: "ajohnson@uwaterloo.invalid" },
  { name: "Cole Bennett", email: "cbennett@uwaterloo.invalid" },
  { name: "Pooja Reddy", email: "preddy@uwaterloo.invalid" },
  { name: "Elena Foster", email: "efoster@uwaterloo.invalid" },
  { name: "Karan Sethi", email: "ksethi@uwaterloo.invalid" },
  { name: "Patrick Murphy", email: "pmurphy@uwaterloo.invalid" },
  { name: "Sofia Morales", email: "smorales@uwaterloo.invalid" },
  { name: "Tanvi Agarwal", email: "tagarwal@uwaterloo.invalid" },
  { name: "Jack Russell", email: "jrussell@uwaterloo.invalid" },
  { name: "Rachel Brooks", email: "rbrooks@uwaterloo.invalid" },
  { name: "Manav Arora", email: "marora@uwaterloo.invalid" },
  { name: "Vanessa Sun", email: "vsun@uwaterloo.invalid" },
  { name: "Caleb Reed", email: "creed@uwaterloo.invalid" },
  { name: "Aanya Khanna", email: "akhanna@uwaterloo.invalid" },
  { name: "Tyler Hughes", email: "thughes@uwaterloo.invalid" },
  { name: "Michelle Lam", email: "mlam@uwaterloo.invalid" },
  { name: "Yusuf Osman", email: "yosman@uwaterloo.invalid" },
  { name: "Katherine Bell", email: "kbell@uwaterloo.invalid" },
  { name: "Sameer Gill", email: "sgill@uwaterloo.invalid" },
  { name: "Zoey Fisher", email: "zfisher@uwaterloo.invalid" },
  { name: "Rishi Narayanan", email: "rnarayanan@uwaterloo.invalid" },
];

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEmailPart(value: string): string {
  return value.trim().toLowerCase();
}

export function formatSeedEmail(
  baseEmailLocalPart: string,
  index: number,
  domain: string,
): string {
  const suffix = String(index).padStart(3, "0");
  return `${normalizeEmailPart(baseEmailLocalPart)}+${suffix}@${normalizeEmailPart(domain)}`;
}

export function formatDisplayName(prefix: string, index: number): string {
  return `${prefix} ${String(index).padStart(3, "0")}`;
}

function convertSeedEmail(email: string): string {
  return email.replace(/@uwaterloo\.invalid$/i, "@uwaterloo.com");
}

export function getSeedRoster(count: number = UWATERLOO_SEED_ROSTER.length) {
  if (count < 1) {
    throw new Error("Seed roster count must be at least 1");
  }

  if (count > UWATERLOO_SEED_ROSTER.length) {
    throw new Error(
      `Cannot seed ${count} users from a roster of ${UWATERLOO_SEED_ROSTER.length}`,
    );
  }

  return UWATERLOO_SEED_ROSTER.slice(0, count).map((entry) => ({
    displayName: entry.name,
    email: convertSeedEmail(entry.email),
    password: DEFAULT_PASSWORD,
  }));
}

export function pickRsvpStatus(rng: () => number): RsvpStatus {
  const roll = rng();
  let threshold = 0;

  for (const { status, weight } of rsvpStatusWeights) {
    threshold += weight;

    if (roll < threshold) {
      return status;
    }
  }

  return "cancelled";
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  context: string,
): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `${context} failed with ${response.status} ${response.statusText}${errorBody ? `: ${errorBody}` : ""}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestOk(
  url: string,
  init: RequestInit,
  context: string,
): Promise<void> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `${context} failed with ${response.status} ${response.statusText}${errorBody ? `: ${errorBody}` : ""}`,
    );
  }
}

function getSupabaseConfig(): SupabaseConfig {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!baseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return { baseUrl, serviceRoleKey };
}

function getSupabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

export function buildSeedUsers(
  options: BuildSeedUsersOptions = {},
): SeedUserInput[] {
  const password = options.password ?? DEFAULT_PASSWORD;
  const count = options.count ?? DEFAULT_USER_COUNT;
  const roster = getSeedRoster(count);

  return roster.map((user) => ({
    email: user.email,
    displayName: user.displayName,
    password,
  }));
}

export function buildSeedRsvpRows(
  users: AuthUserRecord[],
  eventIds: string[],
  options: BuildSeedRsvpsOptions = {},
): SeedRsvpRow[] {
  const count = options.count ?? DEFAULT_RSVP_COUNT;
  const now = options.now ?? (() => new Date());
  const rng = options.rng ?? Math.random;
  const timestamp = now().toISOString();
  const capacity = users.length * eventIds.length;

  if (count > capacity) {
    throw new Error(
      `Cannot generate ${count} unique RSVPs from ${users.length} users and ${eventIds.length} events`,
    );
  }

  const rows: SeedRsvpRow[] = [];
  const seenPairs = new Set<string>();

  while (rows.length < count) {
    const user = users[Math.floor(rng() * users.length)];
    const eventId = eventIds[Math.floor(rng() * eventIds.length)];
    const pairKey = `${user.id}:${eventId}`;

    if (seenPairs.has(pairKey)) {
      continue;
    }

    seenPairs.add(pairKey);
    rows.push({
      userId: user.id,
      eventId,
      status: pickRsvpStatus(rng),
      updatedAt: timestamp,
    });
  }

  return rows;
}

async function fetchAllAuthUsers(config: SupabaseConfig): Promise<AuthUserRecord[]> {
  const users: AuthUserRecord[] = [];
  let page = 1;

  while (true) {
    const url = new URL("/auth/v1/admin/users", config.baseUrl);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(AUTH_USERS_PAGE_SIZE));

    const payload = await requestJson<{ users?: AuthUserRecord[] }>(
      url.toString(),
      {
        headers: getSupabaseHeaders(config.serviceRoleKey),
      },
      `Fetching auth users page ${page}`,
    );

    const pageUsers = payload.users ?? [];
    users.push(...pageUsers);

    if (pageUsers.length < AUTH_USERS_PAGE_SIZE) {
      return users;
    }

    page += 1;
  }
}

async function createAuthUser(
  config: SupabaseConfig,
  user: SeedUserInput,
): Promise<AuthUserRecord> {
  const url = new URL("/auth/v1/admin/users", config.baseUrl);
  const payload = await requestJson<Record<string, unknown>>(
    url.toString(),
    {
      method: "POST",
      headers: getSupabaseHeaders(config.serviceRoleKey),
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.displayName,
          seed_source: "uwaterloo-users",
        },
      }),
    },
    `Creating auth user ${user.email}`,
  );

  const directId =
    typeof payload.id === "string"
      ? payload.id
      : typeof payload.user === "object" &&
          payload.user !== null &&
          "id" in payload.user &&
          typeof (payload.user as { id?: unknown }).id === "string"
        ? (payload.user as { id: string }).id
        : null;

  if (directId) {
    return {
      id: directId,
      email: user.email,
    };
  }

  const refreshedUsers = await fetchAllAuthUsers(config);
  const createdUser = refreshedUsers.find(
    (candidate) => candidate.email?.toLowerCase() === user.email.toLowerCase(),
  );

  if (!createdUser?.id) {
    throw new Error(`Auth user creation for ${user.email} did not return an id`);
  }

  return createdUser;
}

async function ensureAuthUsers(
  config: SupabaseConfig,
  seedUsers: SeedUserInput[],
): Promise<{ created: number; reused: number; users: AuthUserRecord[] }> {
  const existingUsers = await fetchAllAuthUsers(config);
  const existingByEmail = new Map(
    existingUsers
      .filter((user) => user.email)
      .map((user) => [user.email!.toLowerCase(), user] as const),
  );
  const users: AuthUserRecord[] = [];
  let created = 0;
  let reused = 0;

  for (const seedUser of seedUsers) {
    const existing = existingByEmail.get(seedUser.email.toLowerCase());

    if (existing) {
      users.push(existing);
      reused += 1;
      continue;
    }

    const createdUser = await createAuthUser(config, seedUser);
    users.push(createdUser);
    created += 1;
  }

  return { created, reused, users };
}

async function fetchAllEventIds(config: SupabaseConfig): Promise<string[]> {
  const eventIds: string[] = [];
  let offset = 0;

  while (true) {
    const url = new URL("/rest/v1/events", config.baseUrl);
    url.searchParams.set("select", "id");
    url.searchParams.set("order", "created_at.asc");
    url.searchParams.set("limit", String(EVENTS_PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const payload = await requestJson<Array<{ id: string }>>(
      url.toString(),
      {
        headers: getSupabaseHeaders(config.serviceRoleKey),
      },
      `Fetching events page ${offset / EVENTS_PAGE_SIZE + 1}`,
    );

    const pageEventIds = payload.map((event) => event.id);
    eventIds.push(...pageEventIds);

    if (pageEventIds.length < EVENTS_PAGE_SIZE) {
      return eventIds;
    }

    offset += EVENTS_PAGE_SIZE;
  }
}

async function upsertSeedRsvps(
  config: SupabaseConfig,
  rows: SeedRsvpRow[],
): Promise<void> {
  for (const batch of chunk(rows, RSVP_BATCH_SIZE)) {
    const url = new URL("/rest/v1/event_rsvps", config.baseUrl);
    url.searchParams.set("on_conflict", "user_id,event_id");

    await requestOk(
      url.toString(),
      {
        method: "POST",
        headers: {
          ...getSupabaseHeaders(config.serviceRoleKey),
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(
          batch.map((row) => ({
            user_id: row.userId,
            event_id: row.eventId,
            status: row.status,
            updated_at: row.updatedAt,
          })),
        ),
      },
      `Upserting RSVP batch of ${batch.length}`,
    );
  }
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  const config = getSupabaseConfig();
  const userCount = parsePositiveInteger(
    process.env.SEED_UWATERLOO_USER_COUNT,
    DEFAULT_USER_COUNT,
  );
  const rsvpCount = parsePositiveInteger(
    process.env.SEED_UWATERLOO_RSVP_COUNT,
    DEFAULT_RSVP_COUNT,
  );
  const seedUsers = buildSeedUsers({
    count: userCount,
    password: process.env.SEED_USER_PASSWORD ?? DEFAULT_PASSWORD,
  });

  console.log(
    JSON.stringify(
      {
        roster: seedUsers.map(({ email, displayName }) => ({
          email,
          displayName,
        })),
      },
      null,
      2,
    ),
  );

  const eventIds = await fetchAllEventIds(config);

  if (eventIds.length === 0) {
    throw new Error("No events were found to seed RSVPs against");
  }

  const { created, reused, users } = await ensureAuthUsers(config, seedUsers);
  const rsvps = buildSeedRsvpRows(users, eventIds, { count: rsvpCount });

  await upsertSeedRsvps(config, rsvps);

  console.log(
    JSON.stringify(
      {
        createdUsers: created,
        reusedUsers: reused,
        totalUsers: users.length,
        totalEvents: eventIds.length,
        totalRsvps: rsvps.length,
      },
      null,
      2,
    ),
  );
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && import.meta.url === pathToFileURL(entryPoint).href;
}

if (isDirectExecution()) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
