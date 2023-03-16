import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Transfer } from "../generated/templates/FYToken/FYToken";
import { ZERO_ADDRESS, toDecimal } from "./lib";
import { getOrCreateFYToken } from "./fytoken-factory";
import { getOrCreateAsset } from "./cauldron";
import { updateAccountBalance } from "./accounts";

export function handleTransfer(event: Transfer): void {
  let amountDecimal: BigDecimal;

  if (event.params.from == ZERO_ADDRESS) {
    amountDecimal = adjustFYTokenSupply(event.address, event.params.value);
    updateAccountBalance(event.params.to, event.address, null, amountDecimal);
  } else if (event.params.to == ZERO_ADDRESS) {
    amountDecimal = adjustFYTokenSupply(
      event.address,
      event.params.value.times(BigInt.fromI32(-1))
    );
    updateAccountBalance(event.params.from, event.address, null, amountDecimal);
  }
}

function adjustFYTokenSupply(address: Address, amount: BigInt): BigDecimal {
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

  return amountDecimal;
}
