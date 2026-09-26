import type { ChargingDataProvider } from "./provider";

/** Future direct feed boundary, not an enabled or simulated OCPI implementation. */
export interface OCPIProvider extends ChargingDataProvider {
  readonly protocol: "ocpi";
  readonly version: "2.2.1" | "2.3.0";
  readonly countryCode: string;
  readonly partyId: string;
  getChanges(
    since: string,
    cursor?: string,
  ): Promise<{
    locations: Awaited<ReturnType<ChargingDataProvider["getLocations"]>>;
    nextCursor: string | null;
  }>;
}
// Credentials handshake, pagination, push updates, tariff components and EVSE identities
// belong inside a future adapter. No tokens or OCPI DTOs belong in React components.
