import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { PoolCreated } from "../generated/PoolFactory/PoolFactory";
import { FYToken, Pool } from "../generated/schema";
import { Pool as PoolTemplate } from "../generated/templates";
import { Pool as PoolContract } from "../generated/templates/Pool/Pool";
import { createFYToken, getOrCreateFYToken } from "./fytoken-factory";
import { ZERO, ONE, toDecimal } from "./lib";

export function handlePoolCreated(event: PoolCreated): void {
  createPool(event.params.pool, event.block.timestamp);
}

export function createPool(poolAddress: Address, timestamp: BigInt): Pool {
  let pool = new Pool(poolAddress.toHexString());
  let poolContract = PoolContract.bind(poolAddress);
  let decimals = poolContract.decimals();
  pool.decimals = decimals;
  pool.ts = poolContract.ts();
  pool.g1 = poolContract.g1();
  pool.g2 = poolContract.g2();
  pool.isTv = false;

  let baseRes = poolContract.base();
  pool.base = baseRes;

  let sharesToken = poolContract.try_sharesToken();

  if (sharesToken.reverted) {
    pool.sharesToken = baseRes;
  } else {
    pool.sharesToken = sharesToken.value;
  }

  let fyTokenAddress = poolContract.fyToken();
  let fyToken = getOrCreateFYToken(fyTokenAddress);
  pool.fyToken = fyToken.id;

  if (!FYToken.load(pool.fyToken)) {
    createFYToken(fyTokenAddress);
  }

  pool.fyTokenReserves = ZERO.toBigDecimal();
  pool.fyTokenVirtualReserves = ZERO.toBigDecimal();
  pool.baseReserves = ZERO.toBigDecimal();
  pool.apr = ZERO.toBigDecimal();
  pool.lendAPR = ZERO.toBigDecimal();
  pool.borrowAPR = ZERO.toBigDecimal();
  pool.feeAPR = ZERO.toBigDecimal();
  pool.fyTokenInterestAPR = ZERO.toBigDecimal();
  pool.currentFYTokenPriceInBase = ZERO.toBigDecimal();

  pool.poolTokens = ZERO.toBigDecimal();

  pool.totalVolumeInBase = ZERO.toBigDecimal();
  pool.totalTradingFeesInBase = ZERO.toBigDecimal();
  pool.tvlInBase = ZERO.toBigDecimal();

  // invariant init
  let invariant: BigDecimal;
  let invariantResult = poolContract.try_invariant();

  if (invariantResult.reverted) {
    invariant = ONE.toBigDecimal();
  } else {
    invariant = invariantResult.value.toBigDecimal();
  }

  pool.invariant = invariant;
  pool.initInvariant = invariant;

  // if yieldspace tv
  if (pool.sharesToken !== pool.base) {
    pool.isTv = true;
    let c = poolContract.try_getC();
    let mu = poolContract.try_mu();
    let currentSharePrice = poolContract.try_getCurrentSharePrice();

    if (!c.reverted) {
      pool.c = c.value;
    }

    if (!mu.reverted) {
      pool.mu = mu.value;
    }

    if (!currentSharePrice.reverted) {
      pool.currentSharePrice = toDecimal(currentSharePrice.value, decimals);
    }
  }

  pool.lastUpdated = 0;
  pool.createdAtTimestamp = timestamp.toI32();
  pool.save();

  PoolTemplate.create(poolAddress);

  return pool;
}
