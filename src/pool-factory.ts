import { Address } from "@graphprotocol/graph-ts"
import { PoolCreated } from "../generated/PoolFactory/PoolFactory"
import { FYToken, Pool } from "../generated/schema"
import { Pool as PoolTemplate } from '../generated/templates'
import { Pool as PoolContract } from "../generated/templates/Pool/Pool"
import { createFYToken } from "./fytoken-factory"
import { ZERO, ONE } from "./lib"

export function handlePoolCreated(event: PoolCreated): void {
  createPool(event.params.pool)
}

export function createPool(poolAddress: Address): Pool {
  let pool = new Pool(poolAddress.toHexString())
  let poolContract = PoolContract.bind(poolAddress)

  pool.base = poolContract.base()
  let fyTokenAddress = poolContract.fyToken()
  pool.fyToken = fyTokenAddress.toHexString()

  if (!FYToken.load(pool.fyToken)) {
    createFYToken(fyTokenAddress)
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
  pool.lastUpdated = 0
  pool.save()

  PoolTemplate.create(poolAddress)

  return pool
}
