import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { PoolCreated } from "../generated/PoolFactory/PoolFactory";
import { FYToken, Pool } from "../generated/schema";
import { Pool as PoolTemplate } from "../generated/templates";
import { Pool as PoolContract } from "../generated/templates/Pool/Pool";
import { createFYToken } from "./fytoken-factory";
import { ZERO, ONE } from "./lib";

export function handlePoolCreated(event: PoolCreated): void {
  createPool(event.params.pool, event.block.timestamp);
}

export function createPool(poolAddress: Address, timestamp: BigInt): Pool {
  let pool = new Pool(poolAddress.toHexString());
  let poolContract = PoolContract.bind(poolAddress);

  let baseRes = poolContract.base();
  pool.base = baseRes;

  let sharesToken = poolContract.try_sharesToken();

  if (sharesToken.reverted) {
    pool.sharesToken = baseRes;
  } else {
    pool.sharesToken = sharesToken.value;
  }

  let fyTokenAddress = poolContract.fyToken();
  pool.fyToken = fyTokenAddress.toHexString();

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

  let invariant: BigDecimal;
  let invariantResult = poolContract.try_invariant();

  if (invariantResult.reverted) {
    invariant = ONE.toBigDecimal();
  } else {
    invariant = invariantResult.value.toBigDecimal();
  }

  pool.invariant = invariant;
  pool.initInvariant = invariant;

  pool.lastUpdated = 0;
  pool.createdAtTimestamp = timestamp.toI32();
  pool.save();

  PoolTemplate.create(poolAddress);

  return pool;
}
