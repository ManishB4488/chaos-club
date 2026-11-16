import { afterEach, describe, expect, it } from "vitest";
import { connectClient, runCleanups, startServer } from "./socketHelpers";

afterEach(runCleanups);

describe("website and game server on one address", () => {
  it("passes every other request to the website, and keeps /health and live connections working", async () => {
    const { url } = await startServer({
      fallbackHandler: (_req, res) => {
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain");
        res.end("hello from the website");
      },
    });

    const page = await fetch(`${url}/some/page`);
    expect(await page.text()).toBe("hello from the website");

    const health = (await (await fetch(`${url}/health`)).json()) as { status: string };
    expect(health.status).toBe("ok");

    const client = await connectClient(url);
    expect(client.connected).toBe(true);
  });
});
