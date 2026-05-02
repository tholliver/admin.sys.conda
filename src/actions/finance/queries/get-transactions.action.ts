import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, and, gte, lt, desc, sql } from "drizzle-orm";

export const getTransactions = defineAction({
  accept: "json",
  input: z.object({
    affiliationId: z.uuid("ID de afiliación inválido"),
    limit: z.number().int().positive().max(100).default(20),
    type: z.enum(["deposit", "withdraw", "all"]).default("all"),
    startDate: z.iso.datetime().optional(),
    endDate: z.iso.datetime().optional(),
  }),
  async handler(input, { locals }) {
    try {
      if (!locals.user?.id) {
        return {
          success: false,
          error: "No autenticado",
          code: "UNAUTHORIZED",
        };
      }

      const conditions: any[] = [
        sql`${transactions.cashboxId} = ${input.affiliationId}`,
      ];

      if (input.type !== "all") {
        conditions.push(sql`${transactions.type} = ${input.type}`);
      }

      if (input.startDate) {
        conditions.push(gte(transactions.createdAt, new Date(input.startDate)));
      }
      if (input.endDate) {
        conditions.push(lt(transactions.createdAt, new Date(input.endDate)));
      }

      const results = await db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(desc(transactions.createdAt))
        .limit(input.limit);

      return {
        success: true,
        total: results.length,
        transactions: results.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          concept: tx.concept,
          reference: tx.reference,
          authorizedBy: tx.authorizedBy,
          timestamp: tx.createdAt.toISOString(),
          status: tx.status,
        })),
      };
    } catch (error) {
      console.error("Get transactions error:", error);
      return {
        success: false,
        error: "Error al obtener transacciones",
        code: "GET_TRANSACTIONS_ERROR",
      };
    }
  },
});
