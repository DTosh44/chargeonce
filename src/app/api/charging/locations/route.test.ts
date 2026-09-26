import { describe, expect, it, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/providers/charging/factory.server", () => ({
  configuredChargingProvider: vi.fn(() => null),
}));
import { configuredChargingProvider } from "@/providers/charging/factory.server";
import { GET } from "./route";
afterEach(() => vi.clearAllMocks());
describe("public bounded discovery endpoint", () => {
  it.each([
    "",
    "north=60&south=50&east=2&west=-5",
    "north=NaN&south=51&east=0&west=-.1",
    "north=51.6&south=51.5&east=0&west=",
    "north=51.5&south=51.6&east=0&west=-.1",
  ])(
    "rejects invalid or unbounded queries before provider calls: %s",
    async (query) => {
      const response = await GET(
        new Request(`http://localhost/api/charging/locations?${query}`),
      );
      expect(response.status).toBe(400);
      expect(configuredChargingProvider).not.toHaveBeenCalled();
    },
  );
  it("returns explicitly labelled demo data with no-store when no provider is configured", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/charging/locations?north=51.65&south=51.5&east=-.65&west=-.95",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const result = await response.json();
    expect(result.locations).toHaveLength(5);
    expect(result.provider).toBe("mock");
    expect(result.fallbackReason).toBe("missing_configuration");
  });
  it("does not fill healthy empty areas with demo chargers", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/charging/locations?north=53.5&south=53.4&east=-2.1&west=-2.2",
      ),
    );
    expect((await response.json()).locations).toEqual([]);
  });
});
