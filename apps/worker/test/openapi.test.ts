import { describe, it, expect } from "vitest";
import { handleOpenApi } from "../src/routes/openapi";
import { makeEnv, TREASURY } from "./helpers";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function spec(url = "https://worker.example/openapi.json") {
  const res = await handleOpenApi(new Request(url), makeEnv());
  return { res, body: await res.json() as Record<string, any> };
}

describe("GET /openapi.json", () => {
  it("serves JSON that crawlers may cache and read cross-origin", async () => {
    const { res } = await spec();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Cache-Control")).toContain("max-age");
  });

  it("declares the x402 payment block x402scan discovers on", async () => {
    const { body } = await spec();
    expect(body["x-x402"]).toEqual({
      version: 2,
      network: "eip155:8453",
      asset: USDC_BASE,
      payTo: TREASURY,
    });
  });

  it("prices the listing from env, not a hardcoded string", async () => {
    const { body } = await spec();
    const price = body.paths["/x402"].post["x-payment-info"].price;
    expect(price).toMatchObject({ mode: "fixed", currency: "USD", amount: "49.00" });
  });

  it("advertises the origin it was actually called on", async () => {
    const { body } = await spec("https://x402.sources.eth/openapi.json");
    expect(body.servers).toEqual([{ url: "https://x402.sources.eth" }]);
  });

  it("marks the paid route as returning 402", async () => {
    const { body } = await spec();
    expect(body.paths["/x402"].post.responses["402"]).toBeDefined();
  });

  it("requires a payment address on every registration input", async () => {
    const { body } = await spec();
    const schema = body.paths["/x402"].post.requestBody.content["application/json"].schema;
    expect(schema.required).toContain("payment_address");
    expect(schema.properties.payment_chain.const).toBe(8453);
  });

  it("is valid OpenAPI 3.1 with a title", async () => {
    const { body } = await spec();
    expect(body.openapi).toBe("3.1.0");
    expect(body.info.title).toBeTruthy();
  });
});
