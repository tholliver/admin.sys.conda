import type { APIRoute } from "astro";
import { db } from "@/db";
import { sectors } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const GET: APIRoute = async () => {
  const data = await db
    .select({ id: sectors.id, name: sectors.name, cashboxId: sectors.cashboxId })
    .from(sectors)
    .where(eq(sectors.isActive, true))
    .orderBy(asc(sectors.name));

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};
