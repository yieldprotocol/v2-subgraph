import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import {
  NextPoolSet,
  Transfer,
} from "../generated/templates/Strategy/Strategy";
import { Strategy as StrategyTemplate } from "../generated/templates";
import { Strategy as StrategyContract } from "../generated/templates/Strategy/Strategy";
import { Strategy, Pool, Liquidity } from "../generated/schema";
import { ZERO_ADDRESS, toDecimal, ZERO, NEG_ONE_BD } from "./lib";
import { updateAccountBalance } from "./accounts";

export function isStrategy(address: Address): bool {
  let strategyContract = StrategyContract.bind(address);
  let response = strategyContract.try_nextSeriesId();
  return !response.reverted;
}

export function getOrCreateStrategy(strategyAddress: Address): Strategy {
  let strategy = Strategy.load(strategyAddress.toHexString());
  let strategyContract = StrategyContract.bind(strategyAddress);

  if (!strategy) {
    strategy = new Strategy(strategyAddress.toHexString());
    strategy.name = strategyContract.name();
    strategy.symbol = strategyContract.symbol();
    strategy.decimals = strategyContract.decimals();
    strategy.totalSupply = ZERO.toBigDecimal();

    let currentPool = Pool.load(strategyContract.pool().toHexString());
    if (currentPool) {
      strategy.currentPool = currentPool.id;
    }

    strategy.save();

    StrategyTemplate.create(strategyAddress);
  }

  return strategy!;
}

export function handleTransfer(event: Transfer): void {
  let eventId =
    event.transaction.hash.toHex() + "-" + event.transactionLogIndex.toString();

  let liquidity = new Liquidity(eventId);
  liquidity.strategy = event.address.toHexString();
  liquidity.from = event.params.from;
  liquidity.to = event.params.to;
  liquidity.timestamp = event.block.timestamp;

  // amount of strategy tokens transferred in (positive) or transferred out (negative)
  let amountDecimal = BigDecimal.fromString("0");

  if (event.params.from == ZERO_ADDRESS) {
    amountDecimal = adjustStrategySupply(event.address, event.params.value);
    liquidity.amountStrategyTokens = amountDecimal;
    updateAccountBalance(event.params.to, event.address, null, amountDecimal);
  } else if (event.params.to == ZERO_ADDRESS) {
    amountDecimal = adjustStrategySupply(
      event.address,
      event.params.value.times(BigInt.fromI32(-1))
    );
    liquidity.amountStrategyTokens = amountDecimal;
    updateAccountBalance(event.params.from, event.address, null, amountDecimal);
  } else {
    let strategy = getOrCreateStrategy(event.address);
    amountDecimal = toDecimal(event.params.value, strategy.decimals);
    updateAccountBalance(event.params.to, event.address, null, amountDecimal);
    updateAccountBalance(
      event.params.from,
      event.address,
      null,
      amountDecimal.times(NEG_ONE_BD)
    );
  }

  liquidity.save();
}

// returns amount of strategy tokens transferred in (positive) or transferred out (negative) formatted to decimals
function adjustStrategySupply(address: Address, amount: BigInt): BigDecimal {
  let strategy = getOrCreateStrategy(address);
  let amountDecimal = toDecimal(amount, strategy.decimals);
  strategy.totalSupply = strategy.totalSupply.plus(amountDecimal);
  strategy.save();

  return amountDecimal;
}

export function handleUpdatePool(event: NextPoolSet): void {
  let strategy = getOrCreateStrategy(event.address);
  strategy.currentPool = event.params.pool.toHexString();
  strategy.save();
}
