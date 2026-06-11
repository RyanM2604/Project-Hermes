import { z } from "zod";

export const interactionActions = [
  "impression",
  "open",
  "save",
  "rsvp",
  "dismiss",
  "share",
  "filter_click",
] as const;

export type InteractionAction = (typeof interactionActions)[number];

type JsonValue =
  | boolean
  | number
  | string
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

function containsRawEmail(value: JsonValue): boolean {
  if (typeof value === "string") {
    return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value);
  }

  if (Array.isArray(value)) {
    return value.some(containsRawEmail);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, entry]) =>
        key.toLowerCase().includes("email") || containsRawEmail(entry),
    );
  }

  return false;
}

export const interactionPayloadSchema = z.object({
  eventId: z.string().trim().min(1).max(200),
  action: z.enum(interactionActions),
  metadata: z
    .record(z.string(), jsonValueSchema)
    .refine((metadata) => !containsRawEmail(metadata), {
      message: "Metadata must not contain raw email addresses",
    })
    .optional()
    .default({}),
  anonymousSessionId: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});

interface AuthenticatedUser {
  id: string;
}

interface InteractionRepository {
  create(input: {
    action: InteractionAction;
    anonymousSessionId: string | null;
    eventId: string;
    metadata: Record<string, JsonValue>;
    userId: string | null;
  }): Promise<void>;
}

interface LogInteractionOptions {
  getUser: () => Promise<AuthenticatedUser | null>;
  payload: unknown;
  repository: InteractionRepository;
}

type LogInteractionResult =
  | { status: 204 }
  | { body: { error: string }; status: 400 };

export async function logInteraction({
  getUser,
  payload,
  repository,
}: LogInteractionOptions): Promise<LogInteractionResult> {
  const parsed = interactionPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return { body: { error: "Invalid interaction payload" }, status: 400 };
  }

  try {
    const user = await getUser();

    if (!user && !parsed.data.anonymousSessionId) {
      return {
        body: { error: "Anonymous session ID is required" },
        status: 400,
      };
    }

    await repository.create({
      action: parsed.data.action,
      anonymousSessionId: user ? null : parsed.data.anonymousSessionId ?? null,
      eventId: parsed.data.eventId,
      metadata: parsed.data.metadata,
      userId: user?.id ?? null,
    });
  } catch {
    // Interaction logging is non-critical and must not disrupt user flows.
  }

  return { status: 204 };
}

export type { InteractionRepository, JsonValue };
