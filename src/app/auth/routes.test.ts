import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  client: { auth: { exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn() } },
  create: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createSessionClient: mocks.create }));
import { GET as callback } from "./callback/route";
import { GET as confirm } from "./confirm/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue(mocks.client);
});
describe("email and PKCE callback routes", () => {
  it("exchanges a PKCE code and rejects outside return destinations", async () => {
    mocks.client.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await callback(
      new NextRequest(
        "https://chargeonce.example/auth/callback?code=test-code&next=%2F%2Fevil.example",
      ),
    );
    expect(mocks.client.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      "test-code",
    );
    expect(response.headers.get("location")).toBe(
      "https://chargeonce.example/cars",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("accepts allowlisted email token types and drops secrets from the redirect", async () => {
    mocks.client.auth.verifyOtp.mockResolvedValue({ error: null });
    const response = await confirm(
      new NextRequest(
        "https://chargeonce.example/auth/confirm?token_hash=test-only-token&type=email&next=%2Faccount",
      ),
    );
    expect(mocks.client.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "test-only-token",
      type: "email",
    });
    expect(response.headers.get("location")).toBe(
      "https://chargeonce.example/account",
    );
    await confirm(
      new NextRequest(
        "https://chargeonce.example/auth/confirm?token_hash=test&type=recovery",
      ),
    );
    expect(mocks.client.auth.verifyOtp).toHaveBeenCalledTimes(1);
  });
  it("shows expired-link feedback for invalid tokens and missing configuration", async () => {
    mocks.client.auth.verifyOtp.mockResolvedValue({
      error: { message: "expired token details" },
    });
    expect(
      (
        await confirm(
          new NextRequest(
            "https://chargeonce.example/auth/confirm?token_hash=test&type=email",
          ),
        )
      ).headers.get("location"),
    ).toBe("https://chargeonce.example/sign-in?error=expired");
    mocks.create.mockResolvedValue(null);
    expect(
      (
        await callback(
          new NextRequest("https://chargeonce.example/auth/callback?code=test"),
        )
      ).headers.get("location"),
    ).toBe("https://chargeonce.example/sign-in?error=expired");
  });
  it("handles provider outages without exposing token/provider errors", async () => {
    mocks.client.auth.exchangeCodeForSession.mockRejectedValue(
      new Error("private provider details"),
    );
    expect(
      (
        await callback(
          new NextRequest("https://chargeonce.example/auth/callback?code=test"),
        )
      ).headers.get("location"),
    ).toBe("https://chargeonce.example/sign-in?error=unavailable");
  });
});
