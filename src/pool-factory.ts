import { PoolFactory, PoolCreated } from "../generated/PoolFactory/PoolFactory"
import { Pool } from "../generated/schema"
import { Pool as PoolTemplate } from '../generated/templates'
import { ZERO } from "./lib"

export function handlePoolCreated(event: PoolCreated): void {
  let pool = new Pool(event.params.pool.toHexString())
  pool.base = event.params.base
  pool.fyToken = event.params.fyToken.toHexString()
  pool.fyTokenReserves = ZERO.toBigDecimal()
  pool.baseReserves = ZERO.toBigDecimal()
  pool.save()

  PoolTemplate.create(event.params.pool)
}
