import { Transfer } from "../generated/templates/FYToken/FYToken"
import { FYToken } from "../generated/schema"
import { ZERO_ADDRESS, toDecimal } from './lib'

export function handleTransfer(event: Transfer): void {
  if (event.params.from == ZERO_ADDRESS) {
    let entity = FYToken.load(event.address.toHexString())
    entity.totalSupply += toDecimal(event.params.value, entity.decimals)
    entity.save()
  } else if (event.params.to == ZERO_ADDRESS) {
    let entity = FYToken.load(event.address.toHexString())
    entity.totalSupply -= toDecimal(event.params.value, entity.decimals)
    entity.save()
  }
}
