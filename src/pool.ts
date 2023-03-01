import {
  Address,
  BigInt,
  BigDecimal,
  dataSource,
  log,
} from "@graphprotocol/graph-ts";
import {
  Pool as PoolContract,
  Sync,
  Trade as TradeEvent,
  Liquidity as LiquidityEvent,
} from "../generated/templates/Pool/Pool";
import { Asset, Pool, FYToken, Trade } from "../generated/schema";
import { toDecimal, ZERO } from "./lib";
import { getOrCreateAccount } from "./accounts";
import { getGlobalStats } from "./global";

let minimumUpdateTime = new Map<string, i32>();
// Only update arbitrum once per day, due to slow archive queries
minimumUpdateTime.set("arbitrum-one", 60 * 60);
minimumUpdateTime.set("mainnet", 60 * 60);

let SECONDS_PER_YEAR: f64 = 365 * 24 * 60 * 60;
let k = (1 as f64) / ((4 * 365 * 24 * 60 * 60) as f64); // 1 / seconds in four years
let g1 = ((950 as f64) / 1000) as f64;
let g2 = ((1000 as f64) / 950) as f64;
let gNoFee: f64 = 1;

function buyFYDai(
  fyTokenReserves: f64,
  baseReserves: f64,
  timeTillMaturity: i32,
  fyDai: f64,
  g: f64
): f64 {
  let t = k * timeTillMaturity;
  let a = (1 as f64) - g * t;
  let Za = Math.pow(baseReserves, a);
  let Ya = Math.pow(fyTokenReserves, a);
  let Yxa = Math.pow(fyTokenReserves - fyDai, a);
  let y = Math.pow(Za + Ya - Yxa, (1 as f64) / a) - baseReserves;

  return y;
}

function sellFYDai(
  fyTokenReserves: f64,
  baseReserves: f64,
  timeTillMaturity: i32,
  fyDai: f64,
  g: f64
): f64 {
  let t = k * timeTillMaturity;
  let a = (1 as f64) - g * t;
  let Za = Math.pow(baseReserves, a);
  let Ya = Math.pow(fyTokenReserves, a);
  let Yxa = Math.pow(fyTokenReserves + fyDai, a);
  let y = baseReserves - Math.pow(Za + (Ya - Yxa), (1 as f64) / a);

  return y;
}

function getFee(
  fyTokenVirtualReserves: BigDecimal,
  baseReserves: BigDecimal,
  timeTillMaturity: i32,
  fyTokensTraded: BigDecimal
): BigDecimal {
  let fyDaiReservesDecimal = parseFloat(fyTokenVirtualReserves.toString());
  let daiReservesDecimal = parseFloat(baseReserves.toString());
  let fyDaiDecimal = parseFloat(fyTokensTraded.toString());

  let fee: f64 = 0;
  if (fyTokensTraded >= ZERO.toBigDecimal()) {
    let daiWithFee = buyFYDai(
      fyDaiReservesDecimal,
      daiReservesDecimal,
      timeTillMaturity,
      fyDaiDecimal,
      g1
    );
    let daiWithoutFee = buyFYDai(
      fyDaiReservesDecimal,
      daiReservesDecimal,
      timeTillMaturity,
      fyDaiDecimal,
      gNoFee
    );
    fee = daiWithFee - daiWithoutFee;
  } else {
    let daiWithFee = sellFYDai(
      fyDaiReservesDecimal,
      daiReservesDecimal,
      timeTillMaturity,
      -fyDaiDecimal,
      g2
    );
    let daiWithoutFee = sellFYDai(
      fyDaiReservesDecimal,
      daiReservesDecimal,
      timeTillMaturity,
      -fyDaiDecimal,
      gNoFee
    );
    fee = daiWithoutFee - daiWithFee;
  }
  if (fee.toString() == "NaN") {
    return ZERO.toBigDecimal();
  }
  return BigDecimal.fromString(fee.toString());
}

let ts = 10 * 365 * 24 * 60 * 60; // Seconds in 10 years

function calculateInvariant(
  baseReserves: BigDecimal,
  fyTokenVirtualReserves: BigDecimal,
  totalSupply: BigDecimal,
  timeTillMaturity: i32
): BigDecimal {
  if (totalSupply == ZERO.toBigDecimal()) {
    return ZERO.toBigDecimal();
  }

  let fyTokenVirtualReservesDecimal = parseFloat(
    fyTokenVirtualReserves.toString()
  );
  let baseReservesDecimal = parseFloat(baseReserves.toString());
  let totalSupplyDecimal = parseFloat(totalSupply.toString());

  let a = 1 - timeTillMaturity / ts;
  let sum =
    (Math.pow(baseReservesDecimal, a) +
      Math.pow(fyTokenVirtualReservesDecimal, a)) /
    2;
  let result = Math.pow(sum, 1 / a) / totalSupplyDecimal;

  return BigDecimal.fromString(result.toString());
}

function updatePool(
  fyToken: FYToken,
  pool: Pool,
  poolAddress: Address,
  timestamp: i32
): void {
  // Subtract the previous pool TLV. We'll add the updated value back after recalculating it
  // yieldSingleton.poolTLVInDai -= (fyToken.poolDaiReserves + fyToken.poolFYDaiValueInDai)
  let network = dataSource.network();
  if (minimumUpdateTime.has(network)) {
    let timeElapsed = timestamp - pool.lastUpdated;
    let minimumUpdateTimeForNetwork = minimumUpdateTime.get(network);
    if (timeElapsed < minimumUpdateTimeForNetwork) {
      return;
    }
  }

  let poolContract = PoolContract.bind(poolAddress);

  let sellBasePreview: BigDecimal;
  let sellFYTokenPreview: BigDecimal;
  let lendAPR: BigDecimal;
  let currentSharePrice: BigDecimal;

  if (pool.isTv) {
    let currentSharePriceRes = poolContract.try_getCurrentSharePrice();

    if (!currentSharePriceRes.reverted) {
      currentSharePrice = toDecimal(currentSharePriceRes.value, pool.decimals);
    } else {
      currentSharePrice = BigDecimal.fromString("1");
    }
    pool.currentSharePrice = currentSharePrice;
  }

  if (fyToken.maturity < timestamp) {
    sellBasePreview = BigInt.fromI32(1).toBigDecimal();
    sellFYTokenPreview = BigInt.fromI32(1).toBigDecimal();
  } else {
    // for lend estimate (fyToken out)
    let sellBaseResult = poolContract.try_sellBasePreview(
      BigInt.fromI32(10).pow(fyToken.decimals as u8)
    );

    if (sellBaseResult.reverted) {
      sellBasePreview = BigInt.fromI32(0).toBigDecimal();
    } else {
      sellBasePreview = toDecimal(sellBaseResult.value, fyToken.decimals);
    }

    // for borrow estimate (base out for specified fyToken in)
    let sellFYTokenResult = poolContract.try_sellFYTokenPreview(
      BigInt.fromI32(10).pow(fyToken.decimals as u8)
    );

    if (sellFYTokenResult.reverted) {
      sellFYTokenPreview = BigInt.fromI32(0).toBigDecimal();
    } else {
      sellFYTokenPreview = toDecimal(sellFYTokenResult.value, fyToken.decimals);
    }
  }

  pool.currentFYTokenPriceInBase = sellFYTokenPreview; // i.e. 99 base out for 100 fyToken in implies fyToken price of .99 in base terms
  pool.tvlInBase = pool.baseReserves
    .times(currentSharePrice! || BigDecimal.fromString("1")) // if isTv, this is in shares, not base, so need to convert to base
    .plus(pool.fyTokenReserves)
    .times(pool.currentFYTokenPriceInBase);

  let timeTillMaturity =
    fyToken.maturity < timestamp ? 0 : fyToken.maturity - timestamp;

  pool.borrowAPR = sellFYTokenPreview.gt(BigDecimal.fromString("0"))
    ? calcAPR(
        1 / parseFloat(sellFYTokenPreview.toString()), // i.e. 99 base out for 100 fyToken in implies fyToken price of .99 in base terms, so price ratio is 1 / .99
        timeTillMaturity
      )
    : ZERO.toBigDecimal();
  lendAPR = calcAPR(
    parseFloat(sellBasePreview.toString()), // i.e. 101 fyToken out for 100 base in implies base price of 1.01 in fyToken terms
    timeTillMaturity
  );
  pool.apr = lendAPR;
  // fyTokenInterestAPR is interest rate of the fyToken portion of the pool (the ratio of fyToken in base to total value)
  pool.fyTokenInterestAPR = pool.tvlInBase.gt(BigDecimal.fromString("0"))
    ? lendAPR.times(
        pool.fyTokenReserves
          .times(pool.currentFYTokenPriceInBase)
          .div(pool.tvlInBase)
      )
    : ZERO.toBigDecimal();
  pool.lendAPR = lendAPR;

  // calculate fees apr
  let currInvariantResult = poolContract.try_invariant();

  if (currInvariantResult.reverted) {
    pool.invariant = calculateInvariant(
      pool.baseReserves,
      pool.fyTokenVirtualReserves,
      pool.poolTokens,
      timeTillMaturity
    );

    pool.feeAPR = BigInt.fromI32(0).toBigDecimal();
  } else {
    pool.invariant = currInvariantResult.value.toBigDecimal();
    pool.feeAPR = calcAPR(
      parseFloat(
        currInvariantResult.value
          .toBigDecimal()
          .div(pool.initInvariant)
          .toString()
      ),
      timestamp - pool.createdAtTimestamp
    );
  }

  pool.lastUpdated = timestamp;
}

// Adapted from https://github.com/yieldprotocol/fyDai-frontend/blob/master/src/hooks/mathHooks.ts#L219
function calcAPR(priceRatio: f64, timeTillMaturity: i32): BigDecimal {
  if (timeTillMaturity < 0) {
    return ZERO.toBigDecimal();
  }

  let propOfYear = (timeTillMaturity as f64) / SECONDS_PER_YEAR;
  let powRatio = 1 / propOfYear;
  let apr = Math.pow(priceRatio, powRatio) - 1;

  if (apr > 0) {
    let aprPercent = apr * 100;
    return BigDecimal.fromString(aprPercent.toString());
  }
  return ZERO.toBigDecimal();
}

export function handleSync(event: Sync): void {
  let pool = Pool.load(event.address.toHexString())!;
  let fyToken = FYToken.load(pool.fyToken)!;
  let baseToken: Asset;

  // It's possible to create a pool with an asset other than the fyToken's underlying
  // In that case, we skip tracking the base TVL
  if (fyToken.underlyingAddress == pool.base) {
    baseToken = Asset.load(fyToken.underlyingAsset)!;
    baseToken.totalInPools -= pool.baseReserves;
  }

  fyToken.totalInPools -= pool.fyTokenReserves;

  pool.fyTokenReserves =
    toDecimal(event.params.fyTokenCached, fyToken.decimals) - pool.poolTokens;
  pool.fyTokenVirtualReserves = toDecimal(
    event.params.fyTokenCached,
    fyToken.decimals
  );
  pool.baseReserves = toDecimal(event.params.baseCached, fyToken.decimals);

  fyToken.totalInPools += pool.fyTokenReserves;
  fyToken.save();

  if (baseToken) {
    baseToken.totalInPools += pool.baseReserves;
    baseToken.save();
  }

  updatePool(fyToken, pool, event.address, event.block.timestamp.toI32());

  pool.save();
}

export function handleTrade(event: TradeEvent): void {
  let pool = Pool.load(event.address.toHexString())!;
  let fyToken = FYToken.load(pool.fyToken)!;
  let baseToken = Asset.load(fyToken.underlyingAsset);
  let globalStats = getGlobalStats();

  let timeTillMaturity = fyToken.maturity - event.block.timestamp.toI32();
  let fee = getFee(
    pool.fyTokenVirtualReserves,
    pool.baseReserves,
    timeTillMaturity,
    toDecimal(event.params.fyTokens, fyToken.decimals)
  );
  pool.totalTradingFeesInBase += fee;

  let baseVolume = toDecimal(event.params.base, fyToken.decimals);
  if (baseVolume.lt(ZERO.toBigDecimal())) {
    baseVolume = baseVolume.neg();
  }
  pool.totalVolumeInBase += baseVolume;

  baseToken.totalTradingVolume += baseVolume;

  updatePool(fyToken, pool, event.address, event.block.timestamp.toI32());

  let trade = new Trade(
    event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  );
  trade.timestamp = event.block.timestamp;
  trade.pool = event.address.toHexString();
  trade.from = event.params.from;
  trade.to = event.params.to;
  trade.amountBaseToken = toDecimal(event.params.base, baseToken.decimals);
  trade.amountFYToken = toDecimal(event.params.fyTokens, baseToken.decimals);
  trade.feeInBase = fee;

  let trader = getOrCreateAccount(event.params.to);
  trader.numTrades += 1;

  globalStats.numTrades += 1;
  if (trader.numTrades == 1) {
    globalStats.numTraders += 1;
  }

  if (trade.amountBaseToken.gt(BigInt.fromI32(40).toBigDecimal())) {
    globalStats.numTradesOverThreshold += 1;
  }

  pool.save();
  baseToken.save();
  trade.save();
  trader.save();
  globalStats.save();
}

export function handleLiquity(event: LiquidityEvent): void {
  let pool = Pool.load(event.address.toHexString())!;
  let fyToken = FYToken.load(pool.fyToken)!;

  pool.fyTokenReserves -= toDecimal(event.params.poolTokens, fyToken.decimals);
  pool.poolTokens += toDecimal(event.params.poolTokens, fyToken.decimals);

  updatePool(fyToken, pool, event.address, event.block.timestamp.toI32());

  pool.save();
}
