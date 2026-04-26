import { createEmployeeAction, updateEmployeeAction, terminateEmployeeAction, createEmployeeFeeAction, bulkGenerateFeesAction, payEmployeeFeeAction, voidEmployeeFeeAction } from "./rrhh.actions";
import { payEmployeeFeeOverdraftAction } from "./payEmployeeFeeOverdraft.action.ts";
// ─── Barrel export for src/actions/index.ts ───────────────────────────────────

export const rrhh = {
  createEmployee: createEmployeeAction,
  updateEmployee: updateEmployeeAction,
  terminateEmployee: terminateEmployeeAction,
  createEmployeeFee: createEmployeeFeeAction,
  bulkGenerateFees: bulkGenerateFeesAction,
  payEmployeeFee: payEmployeeFeeAction,
  voidEmployeeFee: voidEmployeeFeeAction,
  payEmployeeFeeOverdraft: payEmployeeFeeOverdraftAction
};
