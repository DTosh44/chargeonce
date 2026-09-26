import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/providers/charging/factory.server", () => ({
  externalChargingProvider: vi.fn(),
}));
vi.mock("@/providers/charging/ingestion.server", () => ({
  chargingImportRepository: vi.fn(),
}));
vi.mock("@/providers/charging/ingestion", () => ({
  importChargingRegion: vi.fn(),
}));
import { POST } from "./route";
import { externalChargingProvider } from "@/providers/charging/factory.server";
import { chargingImportRepository } from "@/providers/charging/ingestion.server";
import { importChargingRegion } from "@/providers/charging/ingestion";
import { MockChargingProvider } from "@/providers/charging/mock";
import {
  DEFAULT_CHARGING_BOUNDS,
  ChargingProviderError,
} from "@/providers/charging/provider";

const secret = "test-only-ingestion-secret-32-characters";
const request = (
  value: unknown = { bounds: DEFAULT_CHARGING_BOUNDS },
  authorization = `Bearer ${secret}`,
) =>
  new Request("http://localhost/api/internal/charging/import", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("protected regional import endpoint", () => {
  it("is disabled without a sufficiently long server-side secret", async () => {
    vi.stubEnv("CHARGING_INGESTION_SECRET", "");
    expect((await POST(request())).status).toBe(503);
    vi.stubEnv("CHARGING_INGESTION_SECRET", "short");
    expect((await POST(request())).status).toBe(503);
    expect(importChargingRegion).not.toHaveBeenCalled();
  });
  it.each(["", "Bearer wrong", "Bearer extended-ÿÿÿ"])(
    "rejects incorrect bearer credentials %s",
    async (token) => {
      vi.stubEnv("CHARGING_INGESTION_SECRET", secret);
      expect((await POST(request(undefined, token))).status).toBe(401);
      expect(externalChargingProvider).not.toHaveBeenCalled();
    },
  );
  it("validates bounds before constructing clients or making provider calls", async () => {
    vi.stubEnv("CHARGING_INGESTION_SECRET", secret);
    expect(
      (
        await POST(
          request({ bounds: { north: 60, south: 50, east: 1, west: -5 } }),
        )
      ).status,
    ).toBe(400);
    expect((await POST(request({}))).status).toBe(400);
    expect((await POST(request({ padding: "x".repeat(3000) }))).status).toBe(
      413,
    );
    expect(externalChargingProvider).not.toHaveBeenCalled();
  });
  it("does not invent a successful import when no external provider is configured", async () => {
    vi.stubEnv("CHARGING_INGESTION_SECRET", secret);
    vi.mocked(externalChargingProvider).mockReturnValue(null);
    expect((await POST(request())).status).toBe(503);
    expect(importChargingRegion).not.toHaveBeenCalled();
  });
  it("dispatches authorised bounded work and returns a no-store summary", async () => {
    vi.stubEnv("CHARGING_INGESTION_SECRET", secret);
    vi.mocked(externalChargingProvider).mockReturnValue(
      new MockChargingProvider() as unknown as NonNullable<
        ReturnType<typeof externalChargingProvider>
      >,
    );
    const repository = { importSites: vi.fn(async () => 1) };
    vi.mocked(chargingImportRepository).mockReturnValue(repository);
    vi.mocked(importChargingRegion).mockResolvedValue({
      provider: "test",
      received: 1,
      updated: 1,
      skipped: 0,
      mayBeTruncated: false,
      fetchedAt: "2026-09-26T00:00:00Z",
    });
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(importChargingRegion).toHaveBeenCalledWith(
      expect.anything(),
      repository,
      DEFAULT_CHARGING_BOUNDS,
    );
    expect(await result.json()).toMatchObject({ updated: 1 });
  });
  it("redacts database/upstream failures and credentials", async () => {
    vi.stubEnv("CHARGING_INGESTION_SECRET", secret);
    vi.mocked(externalChargingProvider).mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY=private-key");
    });
    const result = await POST(request());
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain("private-key");
    vi.mocked(externalChargingProvider).mockImplementation(() => {
      throw new ChargingProviderError("not_configured");
    });
    expect((await POST(request())).status).toBe(503);
  });
});
