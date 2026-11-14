import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// Load the shared .env file from the project root (if it exists).
const envFile = resolve(import.meta.dirname, "../../../.env");
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(` - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
