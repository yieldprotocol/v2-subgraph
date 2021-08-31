import { Pool, Trade as TradeEvent, Liquidity as LiquidityEvent } from "../generated/templates/Pool/Pool"
import { Pool, FYToken } from "../generated/schema"
import { EIGHTEEN_DECIMALS, toDecimal } from "./lib"

export function handleTrade(event: TradeEvent): void {
  let pool = Pool.load(event.address.toHexString())
  let fyToken = FYToken.load(pool.fyToken)

  pool.fyTokenReserves -= toDecimal(event.params.fyTokens, fyToken.decimals)
  pool.baseReserves -= toDecimal(event.params.bases, fyToken.decimals)

  pool.save()
}

export function handleLiquity(event: LiquidityEvent): void {
  let pool = Pool.load(event.address.toHexString())
  let fyToken = FYToken.load(pool.fyToken)

  pool.fyTokenReserves -= toDecimal(event.params.fyTokens, fyToken.decimals)
  pool.baseReserves -= toDecimal(event.params.bases, fyToken.decimals)

  pool.save()
}
