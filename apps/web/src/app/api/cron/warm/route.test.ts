import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, warmWords, windowFor, isWarmable } from "./route";

const SECRET = "s3cret";
const req = (auth?: string) =>
  new Request("http://test/api/cron/warm", auth ? { headers: { authorization: auth } } : undefined);

// A gtx dt=bd response, enough for the route under it to parse an answer.
const mockGtx = () =>
  vi.fn(async () => new Response(JSON.stringify([[["x", "y", null, null, 1]], [["noun", ["x"], [["x", [], null, 0.6]]]]])));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// This route spends our Google quota on a schedule, so an open one is a faucet anybody
// can turn on. What it refuses matters more than what it returns.
describe("GET /api/cron/warm auth", () => {
  // @spec WARM-1
  const refuses = async (auth: string | undefined, secret: string | undefined) => {
    if (secret === undefined) vi.stubEnv("CRON_SECRET", "");
    else vi.stubEnv("CRON_SECRET", secret);
    const upstream = mockGtx();
    vi.stubGlobal("fetch", upstream);
    const res = await GET(req(auth));
    expect(res.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  };

  // @spec WARM-1
  it("refuses a request with no authorization at all", async () => {
    await refuses(undefined, SECRET);
  });

  // @spec WARM-1
  it("refuses a wrong secret", async () => {
    await refuses("Bearer nope", SECRET);
  });

  // @spec WARM-1
  it("refuses everything when no secret is configured, rather than opening up", async () => {
    await refuses(`Bearer ${SECRET}`, undefined);
  });

  it("warms the day's slice when the secret matches", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const upstream = mockGtx();
    vi.stubGlobal("fetch", upstream);
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.asked).toBe(100);
    expect(body.warmed).toBe(100);
    expect(body.total).toBe(warmWords().length);
  });
});

// The pass has to come back round to every word, and it has to do it without a stored
// cursor: a redeploy or a cold start must not restart the rotation.
describe("the rolling window", () => {
  // @spec WARM-2
  it("takes 100 a day and moves on the next day", () => {
    const total = warmWords().length;
    expect(windowFor(0, total)).toHaveLength(100);
    expect(windowFor(0, total)[0]).toBe(0);
    expect(windowFor(1, total)[0]).toBe(100);
    expect(windowFor(2, total)[0]).toBe(200);
  });

  // @spec WARM-2
  it("covers the whole head in a pass, and wraps past the end", () => {
    const total = warmWords().length;
    const days = Math.ceil(total / 100);
    const seen = new Set<number>();
    for (let d = 0; d < days; d++) for (const i of windowFor(d, total)) seen.add(i);
    expect(seen.size).toBe(total);
    // The last day of a pass runs off the end and picks up at the start again.
    expect(Math.max(...windowFor(days - 1, total))).toBeGreaterThan(Math.min(...windowFor(days - 1, total)));
  });
});

// A warm request goes through the same gate a card's does, so the list can never hold
// something the route would refuse — that would be a scheduled 400, forever.
describe("what it would send upstream", () => {
  // @spec WARM-3
  it("only ever warms words the translate gate accepts", () => {
    const words = warmWords();
    expect(words.length).toBeGreaterThan(6000);
    expect(words.every(isWarmable)).toBe(true);
  });

  // @spec WARM-3
  it("warms both casings of a case-homograph, which dt=bd answers differently", () => {
    const de = warmWords().filter((w) => w.source === "de");
    expect(de).toContainEqual({ word: "Essen", source: "de", target: "en" });
    expect(de).toContainEqual({ word: "essen", source: "de", target: "en" });
  });
});
