import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/templates/FYToken/FYToken";
import { ZERO_ADDRESS, toDecimal } from "./lib";
import { getOrCreateFYToken } from "./fytoken-factory";
import { getOrCreateAsset } from "./cauldron";

export function handleTransfer(event: Transfer): void {
  if (event.params.from == ZERO_ADDRESS) {
    adjustFYTokenSupply(event.address, event.params.value);
  } else if (event.params.to == ZERO_ADDRESS) {
    adjustFYTokenSupply(
      event.address,
      event.params.value.times(BigInt.fromI32(-1))
    );
  }
}

function adjustFYTokenSupply(address: Address, amount: BigInt): void {
  let fyToken = getOrCreateFYToken(address);
  let amountDecimal = toDecimal(amount, fyToken.decimals);
  fyToken.totalSupply = fyToken.totalSupply.plus(amountDecimal);
  fyToken.save();

  let underlying = getOrCreateAsset(
    Address.fromString(fyToken.underlyingAsset),
    fyToken.underlyingAssetId
  );
  underlying.totalFYTokens = underlying.totalFYTokens.plus(amountDecimal);
  underlying.save();
}
