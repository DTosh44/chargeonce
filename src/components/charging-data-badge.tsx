import { dataState, dataStateLabels } from "@/domain/charging-data";
import type { Charger } from "@/domain/types";
import { Badge } from "./ui";

export function ChargingDataBadge({ charger }: { charger: Charger }) {
  const state = charger.provenance
    ? dataState(charger.provenance)
    : charger.isDemo
      ? "demo"
      : "unknown";
  return (
    <Badge
      tone={
        state === "live" ? "green" : state === "external" ? "blue" : "slate"
      }
    >
      {dataStateLabels[state]}
    </Badge>
  );
}
