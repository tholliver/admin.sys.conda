import { finance } from "@/actions/finance";
import { inquilinos } from "./rrhh/extra.actions";
import { rrhh } from "./rrhh/rrhh.actions";
import { rrhhExtra } from "./rrhh/extra.actions";

export const server = {
  finance,
  inquilinos,
  rrhh,
  rrhhExtra,
}
