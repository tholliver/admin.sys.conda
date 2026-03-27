import { formatBOB, formatNumber as formatPlainNumber } from "./helpers";

export const formatNumber = (num: number) => {
  return formatPlainNumber(num);
};

export const getPercentage = (part: string, total: string) => {
  const partNum = parseFloat(part);
  const totalNum = parseFloat(total);
  if (totalNum === 0 || isNaN(partNum) || isNaN(totalNum)) return 0;
  return ((partNum / totalNum) * 100).toFixed(1);
};
// Compact currency formatter for cards
export const formatCompactCurrency = (amount: string | number) => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "Bs 0,00";
  const absNum = Math.abs(num);

  if (absNum >= 1_000_000) {
    return `Bs ${(num / 1_000_000).toFixed(2)} mill.`;
  }
  if (absNum >= 1_000) {
    return `Bs ${(num / 1_000).toFixed(2)} mil`;
  }
  return formatBOB(num);
};
