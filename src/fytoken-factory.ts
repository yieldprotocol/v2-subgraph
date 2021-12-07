import { FYTokenFactory, FYTokenCreated } from "../generated/FYTokenFactory/FYTokenFactory"
import { FYToken as FYTokenContract } from "../generated/FYTokenFactory/FYToken"
import { FYToken as FYTokenTemplate } from '../generated/templates'
import { FYToken } from "../generated/schema"
import { ZERO } from './lib'

export function handleFYTokenCreated(event: FYTokenCreated): void {
  let fyTokenContract = FYTokenContract.bind(event.params.fyToken)

  let fyToken = new FYToken(event.params.fyToken.toHexString())
  fyToken.name = fyTokenContract.name()
  fyToken.symbol = fyTokenContract.symbol()
  fyToken.underlyingAddress = event.params.asset
  fyToken.underlyingAsset = event.params.asset.toHexString()
  fyToken.underlyingAssetId = fyTokenContract.underlyingId()
  fyToken.maturity = event.params.maturity.toI32()
  fyToken.decimals = fyTokenContract.decimals()
  fyToken.totalSupply = ZERO.toBigDecimal()
  fyToken.totalInPools = ZERO.toBigDecimal()
  fyToken.save()

  FYTokenTemplate.create(event.params.fyToken)
}
