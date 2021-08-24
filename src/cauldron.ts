import { store } from '@graphprotocol/graph-ts'
import {
  Cauldron, AssetAdded, SeriesAdded, IlkAdded, VaultBuilt, VaultPoured, VaultStirred, VaultRolled
} from "../generated/Cauldron/Cauldron"
import { Asset, Collateral, Series, Vault } from "../generated/schema"
import { EIGHTEEN_DECIMALS, ZERO } from './lib'

export function handleAssetAdded(event: AssetAdded): void {
  let asset = new Asset(event.params.assetId.toHexString())
  asset.address = event.params.asset

  asset.save()
}

export function handleSeriesAdded(event: SeriesAdded): void {
  let series = new Series(event.params.seriesId.toHexString())
  series.baseId = event.params.baseId
  series.fyToken = event.params.fyToken

  series.save()
}

export function handleIlkAdded(event: IlkAdded): void {
  let asset = new Collateral(event.params.ilkId.toHexString())
  asset.series = event.params.seriesId.toHexString()

  asset.save()
}

export function handleVaultBuilt(event: VaultBuilt): void {
  let vault = new Vault(event.params.vaultId.toHexString())
  vault.owner = event.params.owner
  vault.series = event.params.seriesId.toHexString()
  vault.collateral = event.params.ilkId.toHexString()
  vault.debtAmount = ZERO.toBigDecimal()
  vault.collateralAmount = ZERO.toBigDecimal()

  vault.save()
}

export function handleVaultDestroyed(event: VaultBuilt): void {
  store.remove('Vault', event.params.vaultId.toHexString())
}

export function handleVaultPoured(event: VaultPoured): void {
  let vault = Vault.load(event.params.vaultId.toHexString())

  // TODO: proper decimals
  vault.debtAmount += event.params.art.divDecimal(EIGHTEEN_DECIMALS)
  vault.collateralAmount += event.params.ink.divDecimal(EIGHTEEN_DECIMALS)

  vault.save()
}

export function handleVaultStirred(event: VaultStirred): void {
  let fromVault = Vault.load(event.params.from.toHexString())
  let toVault = Vault.load(event.params.to.toHexString())

  // TODO: proper decimals
  fromVault.debtAmount -= event.params.art.divDecimal(EIGHTEEN_DECIMALS)
  fromVault.collateralAmount -= event.params.ink.divDecimal(EIGHTEEN_DECIMALS)
  toVault.debtAmount += event.params.art.divDecimal(EIGHTEEN_DECIMALS)
  toVault.collateralAmount += event.params.ink.divDecimal(EIGHTEEN_DECIMALS)

  fromVault.save()
  toVault.save()
}

export function handleVaultRolled(event: VaultRolled): void {
  let vault = Vault.load(event.params.vaultId.toHexString())

  // TODO: we need to update the art, right?
  vault.series = event.params.seriesId.toHexString()

  vault.save()
}
