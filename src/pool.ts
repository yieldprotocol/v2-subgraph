import { Address, BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import {
  Pool as PoolContract,
  Sync,
  Trade as TradeEvent,
  Liquidity as LiquidityEvent
} from "../generated/templates/Pool/Pool"
import { Asset, Pool, FYToken, Trade } from "../generated/schema"
import { EIGHTEEN_DECIMALS, toDecimal, ZERO } from "./lib"

let SECONDS_PER_YEAR: f64 = 365 * 24 * 60 * 60
let k = (1 as f64) / (4 * 365 * 24 * 60 * 60 as f64) // 1 / seconds in four years
let g1 = 950 as f64 / 1000 as f64
let g2 = 1000 as f64 / 950 as f64
let gNoFee: f64 = 1

function buyFYDai(
  fyTokenReserves: f64,
  baseReserves: f64,
  timeTillMaturity: i32,
  fyDai: f64,
  g: f64
): f64 {
  let t = k * timeTillMaturity
  let a = 1 as f64 - (g * t)
  let Za = Math.pow(baseReserves, a)
  let Ya = Math.pow(fyTokenReserves, a)
  let Yxa = Math.pow(fyTokenReserves - fyDai, a)
  let y = Math.pow((Za + Ya) - Yxa, (1 as f64 / a)) - baseReserves

  return y
}

function sellFYDai(
  fyTokenReserves: f64,
  baseReserves: f64,
  timeTillMaturity: i32,
  fyDai: f64,
  g: f64
): f64 {
  let t = k * timeTillMaturity
  let a = 1 as f64 - (g * t)
  let Za = Math.pow(baseReserves, a)
  let Ya = Math.pow(fyTokenReserves, a)
  let Yxa = Math.pow(fyTokenReserves + fyDai, a)
  let y = baseReserves - Math.pow(Za + (Ya - Yxa), (1 as f64 / a))

  return y
}

function getFee(
  fyTokenVirtualReserves: BigDecimal,
  baseReserves: BigDecimal,
  timeTillMaturity: i32,
  fyTokensTraded: BigDecimal
): BigDecimal {
  let fyDaiReservesDecimal = parseFloat(fyTokenVirtualReserves.toString())
  let daiReservesDecimal = parseFloat(baseReserves.toString())
  let fyDaiDecimal = parseFloat(fyTokensTraded.toString())

  let fee: f64 = 0
  if (fyTokensTraded >= ZERO.toBigDecimal()) {
    let daiWithFee = buyFYDai(fyDaiReservesDecimal, daiReservesDecimal, timeTillMaturity, fyDaiDecimal, g1)
    let daiWithoutFee = buyFYDai(fyDaiReservesDecimal, daiReservesDecimal, timeTillMaturity, fyDaiDecimal, gNoFee)
    fee = daiWithFee - daiWithoutFee
  } else {
    let daiWithFee = sellFYDai(fyDaiReservesDecimal, daiReservesDecimal, timeTillMaturity, -fyDaiDecimal, g2)
    let daiWithoutFee = sellFYDai(fyDaiReservesDecimal, daiReservesDecimal, timeTillMaturity, -fyDaiDecimal, gNoFee)
    fee = daiWithoutFee - daiWithFee
  }
  return BigDecimal.fromString(fee.toString())
}

function updatePool(fyToken: FYToken, pool: Pool, poolAddress: Address, timestamp: i32): void {
  // Subtract the previous pool TLV. We'll add the updated value back after recalculating it
  // yieldSingleton.poolTLVInDai -= (fyToken.poolDaiReserves + fyToken.poolFYDaiValueInDai)

  let poolContract = PoolContract.bind(poolAddress)

  let fyDaiPriceInBase: BigDecimal
  if (fyToken.maturity < timestamp) {
    fyDaiPriceInBase = BigInt.fromI32(1).toBigDecimal()
  } else {
    let buyPriceResult = poolContract.try_sellFYTokenPreview(BigInt.fromI32(10).pow((fyToken.decimals as u8) - 2))

    if (buyPriceResult.reverted) {
      fyDaiPriceInBase = BigInt.fromI32(0).toBigDecimal()
    } else {
      fyDaiPriceInBase = toDecimal(buyPriceResult.value * BigInt.fromI32(100), fyToken.decimals)
    }
  }
  pool.currentFYTokenPriceInBase = fyDaiPriceInBase

  pool.apr = yieldAPR(parseFloat(fyDaiPriceInBase.toString()), fyToken.maturity - timestamp)
}

// Adapted from https://github.com/yieldprotocol/fyDai-frontend/blob/master/src/hooks/mathHooks.ts#L219
function yieldAPR(fyDaiPriceInBase: f64, timeTillMaturity: i32): BigDecimal {
  if (timeTillMaturity < 0) {
    return ZERO.toBigDecimal()
  }

  let propOfYear = (timeTillMaturity as f64) / SECONDS_PER_YEAR
  let priceRatio = 1 / fyDaiPriceInBase
  let powRatio = 1 / propOfYear
  let apr = Math.pow(priceRatio, powRatio) - 1

  if (apr > 0 && apr < 100) {
    let aprPercent = apr * 100
    return BigDecimal.fromString(aprPercent.toString())
  }
  return ZERO.toBigDecimal()
}

export function handleSync(event: Sync): void {
  let pool = Pool.load(event.address.toHexString())!
  let fyToken = FYToken.load(pool.fyToken)!
  let baseToken: Asset

  // It's possible to create a pool with an asset other than the fyToken's underlying
  // In that case, we skip tracking the base TVL
  if (fyToken.underlyingAddress == pool.base) {
    baseToken = Asset.load(fyToken.underlyingAsset)!
    baseToken.totalInPools -= pool.baseReserves
  }

  fyToken.totalInPools -= pool.fyTokenReserves

  pool.fyTokenReserves = toDecimal(event.params.fyTokenCached, fyToken.decimals) - pool.poolTokens
  pool.fyTokenVirtualReserves = toDecimal(event.params.fyTokenCached, fyToken.decimals)
  pool.baseReserves = toDecimal(event.params.baseCached, fyToken.decimals)

  fyToken.totalInPools += pool.fyTokenReserves
  fyToken.save()

  if (baseToken) {
    baseToken.totalInPools += pool.baseReserves
    baseToken.save()
  }

  updatePool(fyToken, pool, event.address, event.block.timestamp.toI32())

  pool.save()
}

export function handleTrade(event: TradeEvent): void {
  let pool = Pool.load(event.address.toHexString())!
  let fyToken = FYToken.load(pool.fyToken)!
  let baseToken = Asset.load(fyToken.underlyingAsset)

  let timeTillMaturity = fyToken.maturity - event.block.timestamp.toI32()
  let fee = getFee(
    pool.fyTokenVirtualReserves,
    pool.baseReserves,
    timeTillMaturity,
    toDecimal(event.params.fyTokens, fyToken.decimals)
  )
  pool.totalTradingFeesInBase += fee

  let baseVolume = toDecimal(event.params.bases, fyToken.decimals)
  if (baseVolume.lt(ZERO.toBigDecimal())) {
    baseVolume = baseVolume.neg()
  }
  pool.totalVolumeInBase += baseVolume

  baseToken.totalTradingVolume += baseVolume

  updatePool(fyToken, pool, event.address, event.block.timestamp.toI32())

  let trade = new Trade(event.transaction.hash.toHex() + "-" + event.logIndex.toString())
  trade.timestamp = event.block.timestamp
  trade.pool = event.address.toHexString()
  trade.from = event.params.from
  trade.to = event.params.to
  trade.amountBaseToken = toDecimal(event.params.bases, baseToken.decimals)
  trade.amountFYToken = toDecimal(event.params.fyTokens, baseToken.decimals)
  trade.feeInBase = fee

  pool.save()
  baseToken.save()
  trade.save()
}

export function handleLiquity(event: LiquidityEvent): void {
  let pool = Pool.load(event.address.toHexString())!
  let fyToken = FYToken.load(pool.fyToken)!

  pool.fyTokenReserves -= toDecimal(event.params.poolTokens, fyToken.decimals)
  pool.poolTokens += toDecimal(event.params.poolTokens, fyToken.decimals)

  updatePool(fyToken, pool, event.address, event.block.timestamp.toI32())

  pool.save()
}
