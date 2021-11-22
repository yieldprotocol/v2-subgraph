import { PoolFactory, PoolCreated } from "../generated/PoolFactory/PoolFactory"
import { Pool } from "../generated/schema"
import { Pool as PoolTemplate } from '../generated/templates'
import { ZERO, ONE } from "./lib"

export function handlePoolCreated(event: PoolCreated): void {
  let pool = new Pool(event.params.pool.toHexString())
  pool.base = event.params.base
  pool.fyToken = event.params.fyToken.toHexString()
  pool.fyTokenReserves = ZERO.toBigDecimal()
  pool.fyTokenVirtualReserves = ZERO.toBigDecimal()
  pool.baseReserves = ZERO.toBigDecimal()
  pool.apr = ZERO.toBigDecimal()
  pool.currentFYTokenPriceInBase = ZERO.toBigDecimal()

  pool.poolTokens = ZERO.toBigDecimal()

  pool.totalVolumeInBase = ZERO.toBigDecimal()
  pool.totalTradingFeesInBase = ZERO.toBigDecimal()
  pool.tvlInBase = ZERO.toBigDecimal()
  pool.invariant = ONE.toBigDecimal()
  pool.save()

  PoolTemplate.create(event.params.pool)
}
