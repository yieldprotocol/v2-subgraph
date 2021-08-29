import { FYTokenFactory, FYTokenCreated } from "../generated/FYTokenFactory/FYTokenFactory"
import { FYToken as FYTokenContract } from "../generated/FYTokenFactory/FYToken"
import { FYToken } from "../generated/schema"

export function handleFYTokenCreated(event: FYTokenCreated): void {
  let fyTokenContract = FYTokenContract.bind(event.params.fyToken)

  let fyToken = new FYToken(event.params.fyToken.toHexString())
  fyToken.underlyingAddress = event.params.asset
  fyToken.underlyingAsset = fyTokenContract.underlyingId().toHexString()
  fyToken.maturity = event.params.maturity.toI32()
  fyToken.save()
}
