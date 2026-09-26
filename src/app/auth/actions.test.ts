import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  client: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
  },
  createClient: vi.fn(),
  origin: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSessionClient: mocks.createClient,
}));
vi.mock("@/lib/auth.server", () => ({ authSiteOrigin: mocks.origin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { authenticate, signOut } from "./actions";
const idle = { status: "idle", message: "" } as const;
function form(mode: string) {
  const data = new FormData();
  data.set("mode", mode);
  data.set("email", "driver@example.test");
  data.set("password", "a-unique-long-password");
  data.set("displayName", "Driver");
  data.set("next", "/cars");
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue(mocks.client);
  mocks.origin.mockReturnValue("https://chargeonce.example");
});
describe("server authentication actions", () => {
  it("does not collect/save credentials without configuration", async () => {
    mocks.createClient.mockResolvedValue(null);
    expect((await authenticate(idle, form("password"))).status).toBe("error");
    expect(mocks.client.auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it("keeps bad-password responses generic and gracefully handles provider outages", async () => {
    mocks.client.auth.signInWithPassword.mockResolvedValue({
      error: { message: "sensitive provider detail" },
    });
    expect((await authenticate(idle, form("password"))).message).not.toContain(
      "sensitive",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
    mocks.client.auth.signInWithPassword.mockRejectedValue(
      new Error("offline"),
    );
    expect((await authenticate(idle, form("password"))).status).toBe("error");
  });
  it("redirects valid password sessions locally and refreshes private state", async () => {
    mocks.client.auth.signInWithPassword.mockResolvedValue({ error: null });
    const data = form("password");
    data.set("next", "//evil.example");
    await expect(authenticate(idle, data)).rejects.toThrow("redirect:/cars");
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("sends one-time links only for existing accounts and does not enumerate addresses", async () => {
    mocks.client.auth.signInWithOtp.mockResolvedValue({ error: null });
    const success = await authenticate(idle, form("magic"));
    expect(mocks.client.auth.signInWithOtp).toHaveBeenCalledWith({
      email: "driver@example.test",
      options: {
        shouldCreateUser: false,
        emailRedirectTo:
          "https://chargeonce.example/auth/callback?next=%2Fcars",
      },
    });
    mocks.client.auth.signInWithOtp.mockResolvedValue({
      error: { status: 400, message: "User not found" },
    });
    expect(await authenticate(idle, form("magic"))).toEqual(success);
    mocks.client.auth.signInWithOtp.mockResolvedValue({
      error: { status: 429 },
    });
    expect((await authenticate(idle, form("magic"))).status).toBe("error");
  });
  it("requires strong-enough signup input and an explicitly configured email origin", async () => {
    const data = form("signup");
    data.set("password", "short");
    expect((await authenticate(idle, data)).status).toBe("error");
    expect(mocks.client.auth.signUp).not.toHaveBeenCalled();
    mocks.origin.mockReturnValue(null);
    expect((await authenticate(idle, form("magic"))).status).toBe("error");
  });
  it("waits for confirmation and stores only profile display name metadata", async () => {
    mocks.client.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    expect((await authenticate(idle, form("signup"))).status).toBe("success");
    expect(mocks.client.auth.signUp.mock.calls[0][0].options.data).toEqual({
      display_name: "Driver",
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("does not claim sign-out succeeded when the provider rejects it", async () => {
    mocks.client.auth.signOut.mockResolvedValue({
      error: { message: "offline" },
    });
    expect((await signOut()).status).toBe("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
    mocks.client.auth.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).rejects.toThrow("redirect:/sign-in");
  });
});
