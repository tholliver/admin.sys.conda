import { bob } from "@/utils/currency";

/**
 * Safe decimal arithmetic service for financial calculations in BOB (Bolivianos)
 * Uses BigInt + string-based math to avoid floating-point errors
 *
 * BOB Currency Info:
 * - Symbol: Bs
 * - Subunit: Centavo (1/100)
 * - Smallest coin: 10 centavos (0.10 Bs)
 * - Common denominations: 0.10, 0.20, 0.50, 1, 2, 5, 10, 20, 50, 100, 200 Bs
 */
export class DecimalService {
  private static readonly DECIMAL_PLACES = 2;
  private static readonly SCALE_FACTOR = 100n; // For converting to centavos

  // Bolivian context limits (adjust based on business needs)
  private static readonly MAX_VALUE = "9999999999999.99"; // ~10 trillion Bs (database limit)
  private static readonly MIN_TRANSACTION = "0.01"; // 1 centavo minimum
  private static readonly DAILY_LIMIT = "1000000.00"; // 1 million Bs daily limit (example)

  // Rounding modes
  static readonly ROUND_DOWN = "down";
  static readonly ROUND_UP = "up";
  static readonly ROUND_HALF_UP = "half_up"; // Standard rounding

  /**
   * Validates decimal format: X or X.XX (supports up to 2 decimal places)
   */
  static isValid(str: string): boolean {
    if (!str || typeof str !== "string") return false;
    return /^\d+(\.\d{1,2})?$/.test(str.trim());
  }

  /**
   * Normalizes decimal to XX.XX format
   * @throws {Error} If format is invalid
   */
  static normalize(str: string): string {
    const trimmed = str.trim();

    if (!this.isValid(trimmed)) {
      throw new Error(`Formato inválido: "${str}". Use formato 0.00 o entero`);
    }

    const [integer, decimal] = trimmed.split(".");
    const normalizedDecimal = (decimal || "00").padEnd(
      this.DECIMAL_PLACES,
      "0",
    );

    return `${integer}.${normalizedDecimal}`;
  }

  /**
   * Parses string to BigInt centavos (smallest unit)
   * "1.50" -> 150n
   */
  private static toCentavos(str: string): bigint {
    const normalized = this.normalize(str);
    const [integer, decimal] = normalized.split(".");
    return BigInt(integer) * this.SCALE_FACTOR + BigInt(decimal);
  }

  /**
   * Converts BigInt centavos back to decimal string
   * 150n -> "1.50"
   */
  private static fromCentavos(centavos: bigint): string {
    if (centavos < 0n) {
      return "0.00";
    }

    const integer = centavos / this.SCALE_FACTOR;
    const decimal = centavos % this.SCALE_FACTOR;

    return `${integer}.${decimal.toString().padStart(this.DECIMAL_PLACES, "0")}`;
  }

  /**
   * Compares two decimals: -1 (a < b), 0 (a === b), 1 (a > b)
   */
  static compare(a: string, b: string): number {
    const aCentavos = this.toCentavos(a);
    const bCentavos = this.toCentavos(b);

    if (aCentavos < bCentavos) return -1;
    if (aCentavos > bCentavos) return 1;
    return 0;
  }

  /**
   * Checks if decimal is greater than zero
   */
  static isPositive(str: string): boolean {
    return this.toCentavos(str) > 0n;
  }

  /**
   * Checks if decimal is zero
   */
  static isZero(str: string): boolean {
    return this.toCentavos(str) === 0n;
  }

  /**
   * Checks if decimal is negative (should never happen in our system)
   */
  static isNegative(str: string): boolean {
    return this.toSignedCentavos(str) < 0n;
  }

  /**
   * Checks if a >= b
   */
  static isGreaterOrEqual(a: string, b: string): boolean {
    return this.compare(a, b) >= 0;
  }

  /**
   * Checks if a > b
   */
  static isGreater(a: string, b: string): boolean {
    return this.compare(a, b) > 0;
  }

  /**
   * Checks if a <= b
   */
  static isLessOrEqual(a: string, b: string): boolean {
    return this.compare(a, b) <= 0;
  }

  /**
   * Checks if a < b
   */
  static isLess(a: string, b: string): boolean {
    return this.compare(a, b) < 0;
  }

  /**
   * Adds b to a (a + b)
   * @throws {Error} If inputs are invalid or result exceeds max
   */
  static add(a: string, b: string): string {
    const aCentavos = this.toCentavos(a);
    const bCentavos = this.toCentavos(b);
    const result = aCentavos + bCentavos;

    const resultStr = this.fromCentavos(result);

    // Check overflow
    if (this.compare(resultStr, this.MAX_VALUE) > 0) {
      throw new Error(
        `Operación excede el límite máximo de Bs ${this.MAX_VALUE}`,
      );
    }

    return resultStr;
  }

  /**
   * Subtracts b from a (a - b)
   * Returns "0.00" if result would be negative
   */
  static subtract(a: string, b: string): string {
    const aCentavos = this.toCentavos(a);
    const bCentavos = this.toCentavos(b);
    const result = aCentavos - bCentavos;

    return this.fromCentavos(result); // Handles negative by returning 0.00
  }

  /**
   * Multiplies a by b (a * b)
   * Useful for calculating percentages: amount * rate
   */
  static multiply(a: string, b: string): string {
    const aCentavos = this.toCentavos(a);
    const bCentavos = this.toCentavos(b);

    // Multiply and scale back (divide by SCALE_FACTOR once since we have double scaling)
    const result = (aCentavos * bCentavos) / this.SCALE_FACTOR;

    const resultStr = this.fromCentavos(result);

    if (this.compare(resultStr, this.MAX_VALUE) > 0) {
      throw new Error(
        `Resultado excede el límite máximo de Bs ${this.MAX_VALUE}`,
      );
    }

    return resultStr;
  }

  /**
   * Divides a by b (a / b)
   * @param roundMode - Rounding mode for division
   * @throws {Error} If dividing by zero
   */
  static divide(
    a: string,
    b: string,
    roundMode: "down" | "up" | "half_up" = DecimalService.ROUND_HALF_UP,
  ): string {
    const bCentavos = this.toCentavos(b);

    if (bCentavos === 0n) {
      throw new Error("No se puede dividir entre cero");
    }

    const aCentavos = this.toCentavos(a);

    // Scale up for precision, then divide
    const scaled = aCentavos * this.SCALE_FACTOR;
    let result = scaled / bCentavos;

    // Apply rounding
    const remainder = scaled % bCentavos;
    if (remainder !== 0n) {
      if (roundMode === this.ROUND_UP) {
        result += 1n;
      } else if (roundMode === this.ROUND_HALF_UP) {
        // Round up if remainder >= half of divisor
        if (remainder * 2n >= bCentavos) {
          result += 1n;
        }
      }
      // ROUND_DOWN: do nothing
    }

    return this.fromCentavos(result);
  }

  /**
   * Calculates percentage of amount
   * Example: percentage("100.00", "15") = "15.00" (15% of 100)
   */
  static percentage(amount: string, percent: string): string {
    // Keep precision by multiplying first, then scaling down by 100.
    // Example: 50.00 * 5.50 / 100 = 2.75
    const multiplied = this.multiply(amount, percent);
    return this.divide(multiplied, "100");
  }

  /**
   * Rounds to nearest valid Boliviano denomination (0.10 Bs minimum coin)
   */
  static roundToValidCoin(amount: string): string {
    const centavos = this.toCentavos(amount);

    // Round to nearest 10 centavos (0.10 Bs)
    const rounded = ((centavos + 5n) / 10n) * 10n;

    return this.fromCentavos(rounded);
  }

  /**
   * Parses Bolivian formatted string to normalized decimal
   * "Bs 1.234,56" -> "1234.56"
   * "1.234,56" -> "1234.56"
   */
  static parseBOB(formatted: string): string {
    let cleaned = formatted
      .trim()
      .replace(/^Bs\s*/i, "") // Remove Bs prefix
      .replace(/\s+/g, "");

    if (cleaned.includes(",") && cleaned.includes(".")) {
      // es-BO format: 1.234,56 -> 1234.56
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (cleaned.includes(",")) {
      // Decimal comma without thousand separators: 100,50 -> 100.50
      cleaned = cleaned.replace(",", ".");
    } else if (cleaned.includes(".")) {
      // If dots are thousand separators only (e.g. 1.234 or 1.234.567), remove them.
      const dotParts = cleaned.split(".");
      const isThousandsPattern =
        dotParts.length > 2 ||
        (dotParts.length === 2 && dotParts[1]?.length === 3);
      if (isThousandsPattern) {
        cleaned = cleaned.replace(/\./g, "");
      }
    }

    return this.normalize(cleaned);
  }

  /**
   * Validates amount for transactions
   * @throws {Error} With specific validation message
   */
  static validateAmount(str: string): void {
    const trimmed = str.trim();

    // Format validation
    if (!this.isValid(trimmed)) {
      throw new Error("Formato inválido. Use formato: 123.45 o 123");
    }

    const normalized = this.normalize(trimmed);

    // Maximum transaction
    if (this.compare(normalized, this.MAX_VALUE) > 0) {
      throw new Error(
        `Monto máximo permitido: ${bob(this.MAX_VALUE)}`,
      );
    }

    // Must be positive
    if (!this.isPositive(normalized)) {
      throw new Error("El monto debe ser mayor a cero");
    }

    // Minimum transaction
    if (this.compare(normalized, this.MIN_TRANSACTION) < 0) {
      throw new Error(`Monto mínimo: Bs ${this.MIN_TRANSACTION}`);
    }
  }

  /**
   * Validates amount against daily limit
   */
  static validateDailyLimit(currentTotal: string, newAmount: string): void {
    const total = this.add(currentTotal, newAmount);

    if (this.compare(total, this.DAILY_LIMIT) > 0) {
      throw new Error(
        `Límite diario excedido. Máximo: Bs ${bob(this.DAILY_LIMIT)}`,
      );
    }
  }

  /**
   * Validates sufficient balance for withdrawal
   */
  static validateSufficientBalance(balance: string, amount: string): void {
    if (!this.isGreaterOrEqual(balance, amount)) {
      const deficit = this.subtract(amount, balance);
      throw new Error(
        `Saldo insuficiente. Falta: Bs ${bob(deficit)}`,
      );
    }
  }

  /**
   * Calculates sum of array of amounts
   */
  static sum(amounts: string[]): string {
    return amounts.reduce((acc, amount) => this.add(acc, amount), "0.00");
  }

  /**
   * Calculates average of array of amounts
   */
  static average(amounts: string[]): string {
    if (amounts.length === 0) return "0.00";

    const total = this.sum(amounts);
    return this.divide(total, amounts.length.toString());
  }

  /**
   * Finds maximum amount in array
   */
  static max(amounts: string[]): string {
    if (amounts.length === 0) return "0.00";

    return amounts.reduce((max, current) =>
      this.compare(current, max) > 0 ? current : max,
    );
  }

  /**
   * Finds minimum amount in array
   */
  static min(amounts: string[]): string {
    if (amounts.length === 0) return "0.00";

    return amounts.reduce((min, current) =>
      this.compare(current, min) < 0 ? current : min,
    );
  }

  /**
   * Absolute value
   */
  static abs(amount: string): string {
    const centavos = this.toCentavos(amount);
    return this.fromCentavos(centavos < 0n ? -centavos : centavos);
  }

  /**
   * Converts to integer centavos for database storage if needed
   */
  static toCentavosInt(amount: string): number {
    const centavos = this.toCentavos(amount);

    // Check if safe for JavaScript number
    if (
      centavos > Number.MAX_SAFE_INTEGER ||
      centavos < Number.MIN_SAFE_INTEGER
    ) {
      throw new Error("Monto demasiado grande para conversión a entero");
    }

    return Number(centavos);
  }

  /**
   * Rounds amount to integer units (no decimals), useful for DB values that must be whole numbers.
   */
  static roundToInteger(
    amount: string,
    roundMode: "down" | "up" | "half_up" = DecimalService.ROUND_HALF_UP,
  ): number {
    const normalized = this.normalize(amount);
    const centavos = this.toCentavos(normalized);
    let integerPart = centavos / this.SCALE_FACTOR;
    const remainder = centavos % this.SCALE_FACTOR;

    if (remainder !== 0n) {
      if (roundMode === this.ROUND_UP) {
        integerPart += 1n;
      } else if (roundMode === this.ROUND_HALF_UP) {
        if (remainder * 2n >= this.SCALE_FACTOR) {
          integerPart += 1n;
        }
      }
    }

    if (
      integerPart > BigInt(Number.MAX_SAFE_INTEGER) ||
      integerPart < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new Error("Monto demasiado grande para conversion a entero");
    }

    return Number(integerPart);
  }

  /**
   * Rounds amount to integer and returns normalized decimal string (e.g. "123.00").
   */
  static toIntegerString(
    amount: string,
    roundMode: "down" | "up" | "half_up" = DecimalService.ROUND_HALF_UP,
  ): string {
    const roundedInt = this.roundToInteger(amount, roundMode);
    return `${roundedInt}.00`;
  }

  /**
   * Converts from integer centavos from database
   */
  static fromCentavosInt(centavos: number): string {
    return this.fromCentavos(BigInt(centavos));
  }

  /**
   * Safe parsing with error handling
   */
  static safeParse(str: string): {
    success: boolean;
    value?: string;
    error?: string;
  } {
    try {
      const normalized = this.normalize(str);
      return { success: true, value: normalized };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error de formato",
      };
    }
  }

  /**
   * Validates and normalizes, returns null on error
   */
  static tryNormalize(str: string): string | null {
    try {
      return this.normalize(str);
    } catch {
      return null;
    }
  }

  private static toSignedCentavos(str: string): bigint {
    if (!str || typeof str !== "string") {
      throw new Error("Monto invalido");
    }

    const trimmed = str.trim();
    const sign = trimmed.startsWith("-") ? -1n : 1n;
    const unsigned = trimmed.replace(/^[+-]/, "");
    const centavos = this.toCentavos(unsigned);
    return centavos * sign;
  }
}

// ============================================================================
// UTILITY FUNCTIONS FOR BOLIVIAN CONTEXT
// ============================================================================

/**
 * Common Bolivian bill/coin denominations
 */
export const BOB_DENOMINATIONS = {
  coins: ["0.10", "0.20", "0.50", "1.00", "2.00", "5.00"],
  bills: ["10.00", "20.00", "50.00", "100.00", "200.00"],
} as const;

/**
 * Calculate change breakdown in Bolivian denominations
 */
// export function calculateChangeBOB(amount: string): {
//   bills: Record<string, number>;
//   coins: Record<string, number>;
//   total: string;
// } {
//   let remaining = DecimalService.toCentavos(amount);
//   const bills: Record<string, number> = {};
//   const coins: Record<string, number> = {};

//   // Process bills (largest to smallest)
//   const billDenoms = [...BOB_DENOMINATIONS.bills].reverse();
//   for (const denom of billDenoms) {
//     const denomCentavos = DecimalService.toCentavos(denom);
//     const count = Number(remaining / denomCentavos);
//     if (count > 0) {
//       bills[denom] = count;
//       remaining -= denomCentavos * BigInt(count);
//     }
//   }

//   // Process coins (largest to smallest)
//   const coinDenoms = [...BOB_DENOMINATIONS.coins].reverse();
//   for (const denom of coinDenoms) {
//     const denomCentavos = DecimalService.toCentavos(denom);
//     const count = Number(remaining / denomCentavos);
//     if (count > 0) {
//       coins[denom] = count;
//       remaining -= denomCentavos * BigInt(count);
//     }
//   }

//   return {
//     bills,
//     coins,
//     total: amount,
//   };
// }

// /**
//  * Type guard for decimal strings
//  */
// export function isValidBOBAmount(value: unknown): value is string {
//   return typeof value === "string" && DecimalService.isValid(value);
// }
