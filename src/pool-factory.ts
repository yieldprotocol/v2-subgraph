import { PoolCreated } from "../generated/PoolFactory/PoolFactory"
import { FYToken, Pool } from "../generated/schema"
import { Pool as PoolTemplate } from '../generated/templates'
import { createFYToken } from "./fytoken-factory"
import { ZERO, ONE } from "./lib"

export function handlePoolCreated(event: PoolCreated): void {
  let pool = new Pool(event.params.pool.toHexString())
  pool.base = event.params.base
  pool.fyToken = event.params.fyToken.toHexString()

  if (!FYToken.load(pool.fyToken)) {
    createFYToken(event.params.fyToken)
  }

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
