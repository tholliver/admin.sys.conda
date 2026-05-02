// src/actions/finance/index.ts
import {
  deposit,
  withdraw,
  voidTransaction,
  withdrawOverdraft,
} from "./transactions";

import {
  getBalance,
  getTransactions,
  getDailySummary,
} from "./queries";

import {
  createCashbox,
  toggleCashboxStatus,
  toggleQuickCashbox,
} from "./cashboxes";

import {
  createTransactionCategory,
  updateTransactionCategory,
  deleteTransactionCategory,
  disableTransactionCategory,
  activateTransactionCategory,
  setCategorySortOrder,
} from "./categories";

import {
  transfer,
  payContractor,
  createContractor,
  updateContractorStatus,
} from "./transfers";

import {
  assignCategoryRange,
  unassignCategoryRange,
} from "./ranges";

export const finance = {
  deposit,
  withdraw,
  voidTransaction,
  withdrawOverdraft,
  getBalance,
  getTransactions,
  getDailySummary,
  createCashbox,
  toggleCashboxStatus,
  toggleQuickCashbox,
  createTransactionCategory,
  updateTransactionCategory,
  deleteTransactionCategory,
  disableTransactionCategory,
  activateTransactionCategory,
  setCategorySortOrder,
  transfer,
  payContractor,
  createContractor,
  updateContractorStatus,
  assignCategoryRange,
  unassignCategoryRange,
};

export {
  deposit,
  withdraw,
  voidTransaction,
  withdrawOverdraft,
  getBalance,
  getTransactions,
  getDailySummary,
  createCashbox,
  toggleCashboxStatus,
  toggleQuickCashbox,
  createTransactionCategory,
  updateTransactionCategory,
  deleteTransactionCategory,
  disableTransactionCategory,
  activateTransactionCategory,
  setCategorySortOrder,
  transfer,
  payContractor,
  createContractor,
  updateContractorStatus,
  assignCategoryRange,
  unassignCategoryRange,
};
