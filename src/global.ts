import { YieldGlobalStats } from "../generated/schema";

export function getGlobalStats(): YieldGlobalStats {
  let global = YieldGlobalStats.load('Yield')
  if (!global) {
    global = new YieldGlobalStats('Yield')
    global.numTrades = 0
    global.numTradesOverThreshold = 0
    global.numTraders = 0
  }
  return global!
}
