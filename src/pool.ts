import { Sync, Trade as TradeEvent, Liquidity as LiquidityEvent } from "../generated/templates/Pool/Pool"
import { Pool, FYToken } from "../generated/schema"
import { EIGHTEEN_DECIMALS, toDecimal } from "./lib"

export function handleSync(event: Sync): void {
  let pool = Pool.load(event.address.toHexString())
  let fyToken = FYToken.load(pool.fyToken)

  pool.fyTokenReserves = toDecimal(event.params.fyTokenCached, fyToken.decimals) - pool.poolTokens
  pool.fyTokenVirtualReserves = toDecimal(event.params.fyTokenCached, fyToken.decimals)
  pool.baseReserves = toDecimal(event.params.baseCached, fyToken.decimals)

  pool.save()
}

export function handleTrade(event: TradeEvent): void {}

export function handleLiquity(event: LiquidityEvent): void {
  let pool = Pool.load(event.address.toHexString())
  let fyToken = FYToken.load(pool.fyToken)

  pool.fyTokenReserves -= toDecimal(event.params.poolTokens, fyToken.decimals)
  pool.poolTokens += toDecimal(event.params.poolTokens, fyToken.decimals)

  pool.save()
}
