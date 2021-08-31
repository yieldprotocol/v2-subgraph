import { Pool, Trade as TradeEvent, Liquidity as LiquidityEvent } from "../generated/templates/Pool/Pool"
import { Pool } from "../generated/schema"
import { EIGHTEEN_DECIMALS } from "./lib"

export function handleTrade(event: TradeEvent): void {
  let pool = Pool.load(event.address.toHexString())

  pool.fyTokenReserves -= event.params.fyTokens.divDecimal(EIGHTEEN_DECIMALS)
  pool.baseReserves -= event.params.bases.divDecimal(EIGHTEEN_DECIMALS)

  pool.save()
}

export function handleLiquity(event: LiquidityEvent): void {
  let pool = Pool.load(event.address.toHexString())

  pool.fyTokenReserves -= event.params.fyTokens.divDecimal(EIGHTEEN_DECIMALS)
  pool.baseReserves -= event.params.bases.divDecimal(EIGHTEEN_DECIMALS)

  pool.save()
}
