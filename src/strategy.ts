import { Address, BigInt, dataSource } from "@graphprotocol/graph-ts";
import {
  NextPoolSet,
  Transfer,
} from "../generated/templates/Strategy/Strategy";
import { Strategy as StrategyTemplate } from "../generated/templates";
import { Strategy as StrategyContract } from "../generated/templates/Strategy/Strategy";
import { Strategy, Pool } from "../generated/schema";
import { ZERO_ADDRESS, toDecimal, ZERO } from "./lib";

let strategies = new Map<string, string[]>();
strategies.set("mainnet", [
  "0x7ACFe277dEd15CabA6a8Da2972b1eb93fe1e2cCD",
  "0x1144e14E9B0AA9e181342c7e6E0a9BaDB4ceD295",
  "0xFBc322415CBC532b54749E31979a803009516b5D",
  "0x8e8D6aB093905C400D583EfD37fbeEB1ee1c0c39",
  "0xcf30A5A994f9aCe5832e30C138C9697cda5E1247",
  "0x831dF23f7278575BA0b136296a285600cD75d076",
  "0x47cc34188a2869daa1ce821c8758aa8442715831",
  "0x1565f539e96c4d440c38979dbc86fd711c995dd6",
]);
strategies.set("arbitrum-one", [
  "0xE779cd75E6c574d83D3FD6C92F3CBE31DD32B1E1",
  "0xE7214Af14BD70F6AAC9c16B0c1Ec9ee1CcC7EFDA",
  "0x92A5B31310a3ED4546e0541197a32101fCfBD5c8",
  "0xDC705FB403DBB93Da1d28388bc1DC84274593c11",
]);

export function createStrategies(): void {
  let network = dataSource.network();
  strategies
    .get(network)
    .forEach((strategyAddress) =>
      createStrategy(Address.fromString(strategyAddress))
    );
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
      strategy.currentPool = currentPool;
    }
  }

  strategy.save();

  StrategyTemplate.create(strategyAddress);

  return strategy;
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
  strategy.currentPool = Pool.load(event.params.pool.toHexString());
  strategy.save();
}
