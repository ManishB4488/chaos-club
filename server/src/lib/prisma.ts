import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env";
import { PrismaClient } from "../../generated/prisma/client";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and check the value.");
}

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

/** The one shared database client for the whole server. */
export const prisma = new PrismaClient({ adapter });
