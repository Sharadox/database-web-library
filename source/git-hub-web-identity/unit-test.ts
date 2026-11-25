import { afterEach, expect, test, vi } from "vitest";
import { gitHubWebIdentityToken } from "@sharadox/database-web-library/git-hub-web-identity";

afterEach(() => vi.unstubAllGlobals());

test("asks GitHub Actions for the job's identity token, for AWS", async () => {
  const fetch = vi.fn(async () => Response.json({ value: "the-token" }));
  vi.stubGlobal("fetch", fetch);
  const token = await gitHubWebIdentityToken({
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.example/request?x=1",
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token",
  });
  expect(token).toBe("the-token");
  expect(fetch).toHaveBeenCalledWith("https://token.actions.example/request?x=1&audience=sts.amazonaws.com", {
    headers: { authorization: "Bearer request-token" },
  });
});

test("explains what is missing outside a job with id-token: write, and a refused request", async () => {
  await expect(gitHubWebIdentityToken({})).rejects.toThrow(/id-token: write/);
  vi.stubGlobal("fetch", async () => new Response("no", { status: 403 }));
  await expect(
    gitHubWebIdentityToken({ ACTIONS_ID_TOKEN_REQUEST_URL: "https://x/y", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "t" }),
  ).rejects.toThrow(/403/);
});
