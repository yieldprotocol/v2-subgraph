import { PoolAdded, TokenAdded } from "../generated/Ladle/Ladle";
import { Pool } from "../generated/schema";
import { createPool } from "./pool-factory";
import { getOrCreateStrategy, isStrategy } from "./strategy";

export function handlePoolAdded(event: PoolAdded): void {
  let pool = Pool.load(event.params.pool.toHex());
  if (!pool) {
    createPool(event.params.pool, event.block.timestamp);
  }
}

export function handleTokenAdded(event: TokenAdded): void {
  if (isStrategy(event.params.token)) {
    getOrCreateStrategy(event.params.token);
  }
}
