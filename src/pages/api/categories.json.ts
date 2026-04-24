import type { APIRoute } from "astro";
import { db } from "@/db";
import { transactionCategories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const GET: APIRoute = async () => {
  const data = await db
    .select({
      id:             transactionCategories.id,
      name:           transactionCategories.name,
      type:           transactionCategories.type,
      invoiceRangeId: transactionCategories.invoiceRangeId,
    })
    .from(transactionCategories)
    .where(eq(transactionCategories.status, true))
    .orderBy(asc(transactionCategories.name));

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};
