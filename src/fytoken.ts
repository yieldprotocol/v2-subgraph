import { Address, BigInt } from "@graphprotocol/graph-ts"
import { Transfer } from "../generated/templates/FYToken/FYToken"
import { Asset, FYToken } from "../generated/schema"
import { ZERO_ADDRESS, toDecimal } from './lib'

export function handleTransfer(event: Transfer): void {

  if (event.params.from == ZERO_ADDRESS) {
    adjustFYTokenSupply(event.address, event.params.value)
  } else if (event.params.to == ZERO_ADDRESS) {
    adjustFYTokenSupply(event.address, event.params.value.times(BigInt.fromI32(-1)))
  }
}

function adjustFYTokenSupply(address: Address, amount: BigInt): void {
  let entity = FYToken.load(address.toHexString())
  let amountDecimal = toDecimal(amount, entity.decimals)
  entity.totalSupply += amountDecimal
  entity.save()

  let underlying = Asset.load(entity.underlyingAsset)
  if (underlying) {
    underlying.totalFYTokens += amountDecimal
    underlying.save()
  }
}
