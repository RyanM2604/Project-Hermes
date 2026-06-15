import type { BuildingCode } from "@/types/event";
import { resolveEventLocation } from "./location";

interface EventLocation {
  description?: string;
  buildingCode?: BuildingCode;
  locationName: string;
}

export function formatEventLocation({
  description,
  locationName,
  buildingCode,
}: EventLocation): string {
  const resolved = resolveEventLocation({ description, locationName });

  if (resolved.source === "missing") {
    return resolved.locationName;
  }

  if (
    resolved.buildingCode &&
    !new RegExp(`\\b${resolved.buildingCode}\\b`, "i").test(
      resolved.locationName,
    )
  ) {
    return `${resolved.locationName}, ${resolved.buildingCode}`;
  }

  if (!buildingCode) {
    return resolved.locationName;
  }

  if (new RegExp(`\\b${buildingCode}\\b`, "i").test(resolved.locationName)) {
    return resolved.locationName;
  }

  return `${resolved.locationName}, ${buildingCode}`;
}
