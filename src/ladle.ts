import { PoolAdded } from "../generated/Ladle/Ladle";
import { Pool } from "../generated/schema";
import { createPool } from "./pool-factory";

export function handlePoolAdded(event: PoolAdded): void {
  let pool = Pool.load(event.params.pool.toHex());
  if (!pool) {
    createPool(event.params.pool);
  }
}
