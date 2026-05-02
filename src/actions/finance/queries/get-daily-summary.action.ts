import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { and, gte, lt, sql } from "drizzle-orm";

export const getDailySummary = defineAction({
  accept: "json",
  input: z.object({
    affiliationId: z.uuid("ID de afiliación inválido"),
    date: z.iso.datetime().optional(),
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

      const targetDate = input.date ? new Date(input.date) : new Date();
      const startOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        0, 0, 0, 0,
      );
      const endOfDay = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        targetDate.getDate(),
        23, 59, 59, 999,
      );

      const dailyTxs = await db
        .select()
        .from(transactions)
        .where(
          and(
            sql`${transactions.cashboxId} = ${input.affiliationId}`,
            gte(transactions.createdAt, startOfDay),
            lt(transactions.createdAt, endOfDay),
          ),
        );

      const totalDeposits = dailyTxs
        .filter((tx) => tx.type === "deposit")
        .reduce((sum, tx) => sum + parseFloat(tx.amount as any), 0)
        .toFixed(2);

      const totalWithdraws = dailyTxs
        .filter((tx) => tx.type === "withdraw")
        .reduce((sum, tx) => sum + parseFloat(tx.amount as any), 0)
        .toFixed(2);

      const depositCount = dailyTxs.filter((tx) => tx.type === "deposit").length;
      const withdrawCount = dailyTxs.filter((tx) => tx.type === "withdraw").length;
      const netChange = (parseFloat(totalDeposits) - parseFloat(totalWithdraws)).toFixed(2);

      return {
        success: true,
        summary: {
          date: startOfDay.toISOString(),
          totalDeposits,
          totalWithdraws,
          depositCount,
          withdrawCount,
          netChange,
          transactionCount: dailyTxs.length,
        },
      };
    } catch (error) {
      console.error("Get daily summary error:", error);
      return {
        success: false,
        error: "Error al obtener resumen diario",
        code: "GET_SUMMARY_ERROR",
      };
    }
  },
});
