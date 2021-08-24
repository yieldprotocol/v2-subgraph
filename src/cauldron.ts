import {
  Cauldron, AssetAdded, SeriesAdded, IlkAdded, VaultBuilt
} from "../generated/Cauldron/Cauldron"
import { Asset, Ilk, Series, Vault } from "../generated/schema"

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
  let asset = new Ilk(event.params.ilkId.toHexString())
  asset.series = event.params.seriesId.toHexString()

  asset.save()
}

export function handleVaultBuilt(event: VaultBuilt): void {
  let vault = new Vault(event.params.ilkId.toHexString())
  vault.owner = event.params.owner
  vault.series = event.params.seriesId.toHexString()
  vault.ilk = event.params.ilkId.toHexString()

  vault.save()
}
