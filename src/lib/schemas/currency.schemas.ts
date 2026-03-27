import { z } from "zod";

// --------------- FOR THE CURRENCY ----------
export enum Currency {
  USD = "USD",
  BOB = "BOB",
}

// Get the labels for the currecies for BOB = Bs. | USD = $
export const currencyLabels = {
  USD: "$us",
  BOB: "Bs",
};

export const currencySchema = z.enum(Currency);
export type CurrencyType = z.infer<typeof currencySchema>;
