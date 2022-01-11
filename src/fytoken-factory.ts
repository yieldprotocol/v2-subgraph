import { FYTokenCreated } from "../generated/FYTokenFactory/FYTokenFactory"
import { FYToken as FYTokenContract } from "../generated/FYTokenFactory/FYToken"
import { FYToken as FYTokenTemplate } from '../generated/templates'
import { FYToken } from "../generated/schema"
import { ZERO } from './lib'
import { Address } from "@graphprotocol/graph-ts"

export function handleFYTokenCreated(event: FYTokenCreated): void {
  createFYToken(event.params.fyToken, event.params.asset, event.params.maturity.toI32())
}

export function createFYToken(address: Address, underlying: Address | null = null, maturity: i32 = 0): FYToken {
  let fyTokenContract = FYTokenContract.bind(address)

  let fyToken = new FYToken(address.toHexString())
  fyToken.name = fyTokenContract.name()
  fyToken.symbol = fyTokenContract.symbol()
  fyToken.underlyingAddress = underlying == null ? fyTokenContract.underlying() : underlying!
  fyToken.underlyingAsset = fyToken.underlyingAddress.toHexString()
  fyToken.underlyingAssetId = fyTokenContract.underlyingId()
  fyToken.maturity = maturity || fyTokenContract.maturity().toI32()
  fyToken.decimals = fyTokenContract.decimals()
  fyToken.totalSupply = ZERO.toBigDecimal()
  fyToken.totalInPools = ZERO.toBigDecimal()
  fyToken.save()

  FYTokenTemplate.create(address)

  return fyToken
}
