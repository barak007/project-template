const baseUrl = process.env.SMOKE_BASE_URL;
if (!baseUrl) throw new Error("SMOKE_BASE_URL is required");
const response = await fetch(new URL("/health", baseUrl));
if (!response.ok)
  throw new Error(`Health check failed with ${String(response.status)}`);
const body: unknown = await response.json();
if (JSON.stringify(body) !== '{"status":"ok"}')
  throw new Error("Health response was invalid");
console.info("Smoke test passed");
