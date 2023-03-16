import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { Account, AccountBalance, Asset } from "../generated/schema";
import { getOrCreateAsset } from "./cauldron";
import { ZERO_BD } from "./lib";

export function getOrCreateAccount(address: Address): Account {
  let account = Account.load(address.toHex());
  if (!account) {
    account = new Account(address.toHex());
    account.numTrades = 0;
    account.save();
  }
  return account!;
}

export function getOrCreateAccountBalance(
  accountAddr: Address,
  assetAddr: Address
): AccountBalance {
  let account = getOrCreateAccount(accountAddr);
  let asset = getOrCreateAsset(assetAddr, assetAddr);
  let entityId = account.id + "-" + asset.id;

  let balance = AccountBalance.load(entityId);

  if (!balance) {
    balance = new AccountBalance(entityId);
    balance.account = account.id;
    balance.asset = asset.id;
    balance.balance = ZERO_BD;
  }

  return balance;
}

export function updateAccountBalance(
  accountAddr: Address,
  assetAddr: Address,
  balanceChange: BigDecimal
): void {
  let accountBalance = getOrCreateAccountBalance(accountAddr, assetAddr);
  accountBalance.balance = accountBalance.balance.plus(balanceChange);
  accountBalance.save();
}
