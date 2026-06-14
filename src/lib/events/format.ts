import type { BuildingCode } from "@/types/event";

interface EventLocation {
  locationName: string;
  buildingCode?: BuildingCode;
}

export function formatEventLocation({
  locationName,
  buildingCode,
}: EventLocation): string {
  if (
    !buildingCode ||
    new RegExp(`\\b${buildingCode}\\b`, "i").test(locationName)
  ) {
    return locationName;
  }

  return `${locationName}, ${buildingCode}`;
}
