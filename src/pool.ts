import { BigInt, BigDecimal } from '@graphprotocol/graph-ts'
import { Sync, Trade as TradeEvent, Liquidity as LiquidityEvent } from "../generated/templates/Pool/Pool"
import { Pool, FYToken } from "../generated/schema"
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

export function handleSync(event: Sync): void {
  let pool = Pool.load(event.address.toHexString())
  let fyToken = FYToken.load(pool.fyToken)

  pool.fyTokenReserves = toDecimal(event.params.fyTokenCached, fyToken.decimals) - pool.poolTokens
  pool.fyTokenVirtualReserves = toDecimal(event.params.fyTokenCached, fyToken.decimals)
  pool.baseReserves = toDecimal(event.params.baseCached, fyToken.decimals)

  pool.save()
}

export function handleTrade(event: TradeEvent): void {
  let pool = Pool.load(event.address.toHexString())
  let fyToken = FYToken.load(pool.fyToken)

  let timeTillMaturity = fyToken.maturity - event.block.timestamp.toI32()
  pool.totalTradingFeesInBase += getFee(
    pool.fyTokenVirtualReserves,
    pool.baseReserves,
    timeTillMaturity,
    toDecimal(event.params.fyTokens, fyToken.decimals)
  )
  pool.save()
}

export function handleLiquity(event: LiquidityEvent): void {
  let pool = Pool.load(event.address.toHexString())
  let fyToken = FYToken.load(pool.fyToken)

  pool.fyTokenReserves -= toDecimal(event.params.poolTokens, fyToken.decimals)
  pool.poolTokens += toDecimal(event.params.poolTokens, fyToken.decimals)

  pool.save()
}
