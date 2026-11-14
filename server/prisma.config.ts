import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma commands run from inside the server/ folder, so the shared .env is one level up.
config({ path: "../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
