import { store, Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Cauldron,
  AssetAdded,
  SeriesAdded,
  IlkAdded,
  VaultBuilt,
  VaultTweaked,
  VaultPoured,
  VaultStirred,
  VaultRolled,
  SeriesMatured,
} from "../generated/Cauldron/Cauldron";
import { IERC20 } from "../generated/Cauldron/IERC20";
import {
  Asset,
  Collateral,
  SeriesEntity,
  Vault,
  FYToken,
  Repay,
  Borrow,
  VaultOwner,
} from "../generated/schema";
import { createFYToken } from "./fytoken-factory";
import { EIGHTEEN_DECIMALS, ZERO, toDecimal, ONE } from "./lib";

export function assetIdToAddress(cauldronAddress: Address, id: Bytes): Address {
  let cauldron = Cauldron.bind(cauldronAddress);
  return cauldron.assets(id);
}

function collateralId(seriesId: Bytes, ilkId: Bytes): string {
  return seriesId.toHexString() + "-" + ilkId.toHexString();
}

function tryOr(result: ethereum.CallResult<string>, fallback: string): string {
  return result.reverted ? fallback : result.value;
}
function tryOrInt(result: ethereum.CallResult<i32>, fallback: i32): i32 {
  return result.reverted ? fallback : result.value;
}

export function handleAssetAdded(event: AssetAdded): void {
  getOrCreateAsset(event.params.asset, event.params.assetId);
}

export function getOrCreateAsset(assetAddress: Address, assetId: Bytes): Asset {
  let asset = Asset.load(assetAddress.toHexString());

  if (!asset) {
    let tokenContract = IERC20.bind(assetAddress);

    asset = new Asset(assetAddress.toHexString());
    asset.assetId = assetId;
    asset.name = tryOr(tokenContract.try_name(), "Unknown Asset");
    asset.symbol = tryOr(tokenContract.try_symbol(), "ASSET");
    asset.decimals = tryOrInt(tokenContract.try_decimals(), 0);

    asset.totalFYTokens = ZERO.toBigDecimal();
    asset.totalCollateral = ZERO.toBigDecimal();
    asset.totalDebt = ZERO.toBigDecimal();
    asset.totalTradingVolume = ZERO.toBigDecimal();
    asset.totalInPools = ZERO.toBigDecimal();

    asset.save();
  }

  return asset!;
}

export function handleSeriesAdded(event: SeriesAdded): void {
  let series = new SeriesEntity(event.params.seriesId.toHexString());
  series.baseAsset = assetIdToAddress(
    event.address,
    event.params.baseId
  ).toHexString();
  series.fyToken = event.params.fyToken.toHexString();
  series.matured = false;

  let fyToken = FYToken.load(event.params.fyToken.toHexString());
  if (!fyToken) {
    fyToken = createFYToken(event.params.fyToken);
  }

  series.maturity = fyToken.maturity;

  series.save();
}

export function handleIlkAdded(event: IlkAdded): void {
  let collateral = new Collateral(
    collateralId(event.params.seriesId, event.params.ilkId)
  );
  collateral.series = event.params.seriesId.toHexString();
  collateral.asset = assetIdToAddress(
    event.address,
    event.params.ilkId
  ).toHexString();

  collateral.save();
}

export function handleVaultBuilt(event: VaultBuilt): void {
  let vault = new Vault(event.params.vaultId.toHexString());
  let owner = event.params.owner.toHexString();
  let vaultOwner = new VaultOwner(owner);

  vault.owner = owner;
  vault.series = event.params.seriesId.toHexString();
  vault.collateral = collateralId(event.params.seriesId, event.params.ilkId);
  vault.debtAmount = ZERO.toBigDecimal();
  vault.collateralAmount = ZERO.toBigDecimal();
  vault.liquidated = false;

  vault.save();
  vaultOwner.save();
}

export function handleVaultTweaked(event: VaultTweaked): void {
  let vault = Vault.load(event.params.vaultId.toHexString());
  vault.collateral = collateralId(event.params.seriesId, event.params.ilkId);

  vault.save();
}

export function handleVaultDestroyed(event: VaultBuilt): void {
  store.remove("Vault", event.params.vaultId.toHexString());
}

export function handleVaultPoured(event: VaultPoured): void {
  let vault = Vault.load(event.params.vaultId.toHexString());
  let collateral = Collateral.load(vault.collateral);
  let series = SeriesEntity.load(vault.series);
  let seriesAsset = Asset.load(series.baseAsset);
  let collateralAsset = Asset.load(collateral.asset);

  let debtDelta = toDecimal(event.params.art, seriesAsset.decimals);
  let collateralDelta = toDecimal(event.params.ink, collateralAsset.decimals);

  vault.debtAmount += debtDelta;
  vault.collateralAmount += collateralDelta;

  seriesAsset.totalDebt += debtDelta;
  collateralAsset.totalCollateral += collateralDelta;

  let isBorrow = debtDelta.gt(ZERO.toBigDecimal());
  let eventId =
    event.transaction.hash.toHex() + "-" + event.transactionLogIndex.toString();
  if (isBorrow) {
    let borrow = new Borrow(eventId);
    borrow.tx = event.transaction.hash;
    borrow.debtAsset = series.baseAsset;
    borrow.collateralAsset = collateral.asset;
    borrow.vault = vault.id;
    borrow.debtAmount = debtDelta;
    borrow.collateralAmount = collateralDelta;

    borrow.save();
  } else {
    let repay = new Repay(eventId);
    repay.tx = event.transaction.hash;
    repay.debtAsset = series.baseAsset;
    repay.collateralAsset = collateral.asset;
    repay.vault = vault.id;
    repay.debtAmount = debtDelta.times(ONE.neg().toBigDecimal());
    repay.collateralAmount = collateralDelta.times(ONE.neg().toBigDecimal());

    repay.save();
  }

  vault.save();
  seriesAsset.save();
  collateralAsset.save();
}

export function handleVaultStirred(event: VaultStirred): void {
  let fromVault = Vault.load(event.params.from.toHexString());
  let toVault = Vault.load(event.params.to.toHexString());

  let collateral = Collateral.load(fromVault.collateral);
  let series = SeriesEntity.load(fromVault.series);
  let seriesAsset = Asset.load(series.baseAsset);
  let collateralAsset = Asset.load(collateral.asset);

  let debtDelta = toDecimal(event.params.art, seriesAsset.decimals);
  let collateralDelta = toDecimal(event.params.ink, collateralAsset.decimals);

  fromVault.debtAmount -= debtDelta;
  fromVault.collateralAmount -= collateralDelta;
  toVault.debtAmount += debtDelta;
  toVault.collateralAmount += collateralDelta;

  let eventId =
    event.transaction.hash.toHex() + "-" + event.transactionLogIndex.toString();
  let repay = new Repay(eventId + "-repay");
  repay.tx = event.transaction.hash;
  repay.debtAsset = series.baseAsset;
  repay.collateralAsset = collateral.asset;
  repay.vault = fromVault.id;
  repay.debtAmount = debtDelta;
  repay.collateralAmount = collateralDelta;

  let borrow = new Borrow(eventId + "-borrow");
  borrow.tx = event.transaction.hash;
  borrow.debtAsset = series.baseAsset;
  borrow.collateralAsset = collateral.asset;
  borrow.vault = toVault.id;
  borrow.debtAmount = debtDelta;
  borrow.collateralAmount = collateralDelta;

  fromVault.save();
  toVault.save();
  borrow.save();
  repay.save();
}

export function handleVaultRolled(event: VaultRolled): void {
  let vault = Vault.load(event.params.vaultId.toHexString());

  // TODO: we need to update the art, right?
  vault.series = event.params.seriesId.toHexString();

  vault.save();
}

export function handleVaultGiven(event: VaultGiven): void {
  let vault = Vault.load(event.params.vaultId.toHexString());
  let receiver = event.params.receiver.toHexString();
  let vaultOwner = VaultOwner.load(vault.owner);

  // check if new owner is the witch (both mainnet and arbitrum witch addresses)
  if (
    event.params.receiver ==
      Address.fromString("0x53C3760670f6091E1eC76B4dd27f73ba4CAd5061") ||
    event.params.receiver ==
      Address.fromString("0x08173D0885B00BDD640aaE57D05AbB74cd00d669")
  ) {
    vault.liquidated = true;
  }

  vault.owner = receiver;
  vaultOwner.id = receiver;
  vaultOwner.save();
  vault.save();
}

export function handleSeriesMatured(event: SeriesMatured): void {
  let series = SeriesEntity.load(event.params.seriesId.toHexString());
  series.matured = true;

  series.save();
}
