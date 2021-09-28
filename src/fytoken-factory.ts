import { FYTokenFactory, FYTokenCreated } from "../generated/FYTokenFactory/FYTokenFactory"
import { FYToken as FYTokenContract } from "../generated/FYTokenFactory/FYToken"
import { FYToken } from "../generated/schema"
import { ZERO } from './lib'

export function handleFYTokenCreated(event: FYTokenCreated): void {
  let fyTokenContract = FYTokenContract.bind(event.params.fyToken)

  let fyToken = new FYToken(event.params.fyToken.toHexString())
  fyToken.name = fyTokenContract.name()
  fyToken.symbol = fyTokenContract.symbol()
  fyToken.underlyingAddress = event.params.asset
  fyToken.underlyingAsset = fyTokenContract.underlyingId().toHexString()
  fyToken.maturity = event.params.maturity.toI32()
  fyToken.decimals = fyTokenContract.decimals()
  fyToken.totalInPools = ZERO.toBigDecimal()
  fyToken.save()
}
