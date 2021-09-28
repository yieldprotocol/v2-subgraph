import { store, Bytes } from '@graphprotocol/graph-ts'
import {
  Cauldron, AssetAdded, SeriesAdded, IlkAdded, VaultBuilt, VaultTweaked, VaultPoured, VaultStirred, VaultRolled
} from "../generated/Cauldron/Cauldron"
import { IERC20 } from "../generated/Cauldron/IERC20"
import { Asset, Collateral, Series, Vault } from "../generated/schema"
import { EIGHTEEN_DECIMALS, ZERO, toDecimal } from './lib'

function collateralId(seriesId: Bytes, ilkId: Bytes): string {
  return seriesId.toHexString() + '-' + ilkId.toHexString()
}

export function handleAssetAdded(event: AssetAdded): void {
  let tokenContract = IERC20.bind(event.params.asset)

  let asset = new Asset(event.params.assetId.toHexString())
  asset.address = event.params.asset
  asset.name = tokenContract.name()
  asset.symbol = tokenContract.symbol()
  asset.decimals = tokenContract.decimals()

  asset.totalTradingVolume = ZERO.toBigDecimal()

  asset.save()
}

export function handleSeriesAdded(event: SeriesAdded): void {
  let series = new Series(event.params.seriesId.toHexString())
  series.baseAsset = event.params.baseId.toHexString()
  series.fyToken = event.params.fyToken.toHexString()

  series.save()
}

export function handleIlkAdded(event: IlkAdded): void {
  let collateral = new Collateral(collateralId(event.params.seriesId, event.params.ilkId))
  collateral.series = event.params.seriesId.toHexString()
  collateral.asset = event.params.ilkId.toHexString()

  collateral.save()
}

export function handleVaultBuilt(event: VaultBuilt): void {
  let vault = new Vault(event.params.vaultId.toHexString())
  vault.owner = event.params.owner
  vault.series = event.params.seriesId.toHexString()
  vault.collateral = collateralId(event.params.seriesId, event.params.ilkId)
  vault.debtAmount = ZERO.toBigDecimal()
  vault.collateralAmount = ZERO.toBigDecimal()

  vault.save()
}

export function handleVaultTweaked(event: VaultTweaked): void {
  let vault = Vault.load(event.params.vaultId.toHexString())
  vault.collateral = collateralId(event.params.seriesId, event.params.ilkId)

  vault.save()
}

export function handleVaultDestroyed(event: VaultBuilt): void {
  store.remove('Vault', event.params.vaultId.toHexString())
}

export function handleVaultPoured(event: VaultPoured): void {
  let vault = Vault.load(event.params.vaultId.toHexString())
  let collateral = Collateral.load(vault.collateral)
  let series = Series.load(vault.series)
  let seriesAsset = Asset.load(series.baseAsset)
  let collateralAsset = Asset.load(collateral.asset)

  vault.debtAmount += toDecimal(event.params.art, seriesAsset.decimals)
  vault.collateralAmount += toDecimal(event.params.ink, collateralAsset.decimals)

  vault.save()
}

export function handleVaultStirred(event: VaultStirred): void {
  let fromVault = Vault.load(event.params.from.toHexString())
  let toVault = Vault.load(event.params.to.toHexString())

  let collateral = Collateral.load(fromVault.collateral)
  let series = Series.load(fromVault.series)
  let seriesAsset = Asset.load(series.baseAsset)
  let collateralAsset = Asset.load(collateral.asset)

  fromVault.debtAmount -= toDecimal(event.params.art, seriesAsset.decimals)
  fromVault.collateralAmount -= toDecimal(event.params.ink, collateralAsset.decimals)
  toVault.debtAmount += toDecimal(event.params.art, seriesAsset.decimals)
  toVault.collateralAmount += toDecimal(event.params.ink, collateralAsset.decimals)

  fromVault.save()
  toVault.save()
}

export function handleVaultRolled(event: VaultRolled): void {
  let vault = Vault.load(event.params.vaultId.toHexString())

  // TODO: we need to update the art, right?
  vault.series = event.params.seriesId.toHexString()

  vault.save()
}
