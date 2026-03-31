import { finance } from "./finance";
import { inquilinos } from "./rrhh/extra.actions";
import { rrhh } from "./rrhh/rrhh.actions";
import { rrhhExtra } from "./rrhh/extra.actions";
import { sectorActions } from "./rrhh/sector.actions";

export const server = {
  finance,
  inquilinos,
  rrhh,
  rrhhExtra,
  sector: sectorActions,
};
