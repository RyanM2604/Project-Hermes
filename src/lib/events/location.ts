import type { BuildingCode } from "@/types/event";

const LOCATION_PLACEHOLDERS = new Set([
  "location not provided",
  "location unavailable",
  "see source for location",
  "see original source for location",
  "details in source",
  "details available in source",
  "tba",
  "to be announced",
  "online",
  "virtual",
]);

const BUILDING_CODE_ALIASES: Array<[RegExp, BuildingCode]> = [
  [/\bEast Campus 5\b/i, "EC5"],
  [/\bEC5\b/i, "EC5"],
  [/\bE5\b/i, "E5"],
  [/\bE7\b/i, "E7"],
  [/\bSLC\b/i, "SLC"],
  [/\bQNC\b/i, "QNC"],
  [/\bMC\b/i, "MC"],
  [/\bTC\b/i, "TC"],
  [/\bDC\b/i, "DC"],
  [/\bPAC\b/i, "PAC"],
  [/\bFED\b/i, "FED"],
  [/\bAL\b/i, "AL"],
  [/\bSCH\b/i, "SCH"],
];

const LOCATION_PATTERNS = [
  /(?:^|[\n.])\s*(?:location|where|venue|place|located at)\s*[:\-]\s*([^\n.;]{3,120})/i,
  /(?:^|[\n.])\s*(?:held|happening|taking place)\s+(?:at|in|inside|within)\s+(?:the\s+)?([^\n.;]{3,120})/i,
  /(?:^|[\n.])\s*(?:at|in|inside|within)\s+(?:the\s+)?([^\n.;]{3,120})/i,
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim().replace(/[.,;:\s]+$/u, "");
}

function normalizeAliases(value: string): string {
  return BUILDING_CODE_ALIASES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    normalizeWhitespace(value),
  );
}

function trimLocationClause(value: string): string {
  return normalizeWhitespace(
    normalizeAliases(value)
      .replace(/^(?:join us|come join us|meet us|find us|stop by|drop in|visit us)\s+/i, "")
      .replace(/^(?:at|in|inside|within)\s+(?:the\s+)?/i, "")
      .replace(/\s+(?:for|to|with|during|while|about|after|before|on|at|in)\b.*$/i, ""),
  );
}

export function isPlaceholderLocation(value: string): boolean {
  return LOCATION_PLACEHOLDERS.has(normalizeAliases(value).toLowerCase());
}

function isMeaningfulCandidate(value: string): boolean {
  const normalized = trimLocationClause(value);

  if (!normalized || isPlaceholderLocation(normalized)) {
    return false;
  }

  return (
    /\b(?:room|hall|theatre|theater|atrium|centre|center|building|auditorium|suite|floor)\b/i.test(
      normalized,
    ) ||
    /\b(?:EC5|E5|E7|SLC|QNC|MC|TC|DC|PAC|FED|AL|SCH)\b/i.test(normalized) ||
    /\b[A-Z]{1,3}\s?\d{3,4}\b/.test(normalized) ||
    /,\s*[A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+)*/.test(normalized)
  );
}

export function deriveBuildingCode(
  locationName: string,
): BuildingCode | undefined {
  const normalized = normalizeAliases(locationName);

  return BUILDING_CODE_ALIASES.find(([pattern]) => pattern.test(normalized))?.[1];
}

export function extractLocationFromDescription(
  description: string,
): string | undefined {
  const normalized = normalizeAliases(description);

  if (!normalized) {
    return undefined;
  }

  for (const pattern of LOCATION_PATTERNS) {
    const match = pattern.exec(normalized);

    if (!match) {
      continue;
    }

    const candidate = trimLocationClause(match[1]);

    if (isMeaningfulCandidate(candidate)) {
      return trimLocationClause(candidate);
    }
  }

  const fragments = normalized
    .split(/\n+|(?<=[.!?])\s+/u)
    .map((fragment) => normalizeAliases(fragment))
    .filter(Boolean);

  for (const fragment of fragments) {
    const candidate = trimLocationClause(fragment);

    if (isMeaningfulCandidate(candidate)) {
      return trimLocationClause(candidate);
    }
  }

  return undefined;
}

export function resolveEventLocation(input: {
  description?: string | null;
  locationName?: string | null;
}): {
  buildingCode?: BuildingCode;
  locationName: string;
  source: "description" | "missing" | "structured";
} {
  const structured = normalizeAliases(input.locationName ?? "");

  if (structured && !isPlaceholderLocation(structured)) {
    return {
      buildingCode: deriveBuildingCode(structured),
      locationName: structured,
      source: "structured",
    };
  }

  const fromDescription = extractLocationFromDescription(
    input.description ?? "",
  );

  if (fromDescription) {
    return {
      buildingCode: deriveBuildingCode(fromDescription),
      locationName: fromDescription,
      source: "description",
    };
  }

  return {
    locationName: "See source for location",
    source: "missing",
  };
}
