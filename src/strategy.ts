import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import {
  NextPoolSet,
  Transfer,
} from "../generated/templates/Strategy/Strategy";
import { Strategy as StrategyTemplate } from "../generated/templates";
import { Strategy as StrategyContract } from "../generated/templates/Strategy/Strategy";
import { Strategy, Pool } from "../generated/schema";
import { ZERO_ADDRESS, toDecimal, ZERO } from "./lib";

export function isStrategy(address: Address): bool {
  let strategyContract = StrategyContract.bind(address);
  let response = strategyContract.try_nextSeriesId();
  return !response.reverted;
}

export function createStrategy(strategyAddress: Address): Strategy {
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
  if (event.params.from == ZERO_ADDRESS) {
    adjustStrategySupply(event.address, event.params.value);
  } else if (event.params.to == ZERO_ADDRESS) {
    adjustStrategySupply(
      event.address,
      event.params.value.times(BigInt.fromI32(-1))
    );
  }
}

function adjustStrategySupply(address: Address, amount: BigInt): void {
  let entity = Strategy.load(address.toHexString());
  let amountDecimal = toDecimal(amount, entity.decimals);
  entity.totalSupply += amountDecimal;
  entity.save();
}

export function handleUpdatePool(event: NextPoolSet): void {
  let strategy = Strategy.load(event.address.toHexString());
  strategy.currentPool = event.params.pool.toHexString();
  strategy.save();
}
