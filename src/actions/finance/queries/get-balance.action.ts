import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactions, cashboxes } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const getBalance = defineAction({
  accept: "json",
  input: z.object({
    affiliationId: z.uuid("ID de afiliación inválido"),
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

      const affiliation = await db
        .select()
        .from(cashboxes)
        .where(eq(cashboxes.id, input.affiliationId))
        .then((rows) => rows[0]);

      if (!affiliation) {
        return {
          success: true,
          balance: "0.00",
          status: "inactive",
          transactions: [],
        };
      }

      const recentTransactions = await db
        .select()
        .from(transactions)
        .where(sql`${transactions.cashboxId} = ${input.affiliationId}`)
        .orderBy(desc(transactions.createdAt))
        .limit(50);

      return {
        success: true,
        balance: affiliation.balance,
        status: affiliation.status,
        transactions: recentTransactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          concept: tx.concept,
          externalReference: tx.externalReference,
          invoiceNumber: tx.invoiceNumber,
          authorizedBy: tx.authorizedBy,
          timestamp: tx.createdAt.toISOString(),
          status: tx.status,
        })),
      };
    } catch (error) {
      console.error("Get balance error:", error);
      return {
        success: false,
        error: "Error al obtener balance",
        code: "GET_BALANCE_ERROR",
      };
    }
  },
});
