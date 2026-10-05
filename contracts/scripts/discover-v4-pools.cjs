const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;

  const poolManager =
    "0x8366a39CC670B4001A1121B8F6A443A643e40951";

  const token =
    "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

  const iface = new hre.ethers.Interface([
    "event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)"
  ]);

  const topic = iface.getEvent("Initialize").topicHash;
  const latest = await provider.getBlockNumber();

  const CHUNK = 500000;

  console.log("=== V4 POOL DISCOVERY ===");
  console.log("PoolManager:", poolManager);
  console.log("Token:", token);
  console.log("Latest block:", latest);
  console.log("");

  let matches = 0;

  for (let from = 0; from <= latest; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, latest);

    console.log(`Scanning ${from} -> ${to}`);

    let logs;

    try {
      logs = await provider.getLogs({
        address: poolManager,
        topics: [topic],
        fromBlock: from,
        toBlock: to
      });
    } catch (e) {
      console.log("  RPC error:", e.message);
      continue;
    }

    for (const log of logs) {
      const parsed = iface.parseLog(log);

      const c0 = parsed.args.currency0;
      const c1 = parsed.args.currency1;

      if (
        c0.toLowerCase() === token.toLowerCase() ||
        c1.toLowerCase() === token.toLowerCase()
      ) {
        matches++;

        console.log("");
        console.log("========== MATCH ==========");
        console.log("Block:", log.blockNumber);
        console.log("TX:", log.transactionHash);
        console.log("Pool ID:", parsed.args.id);
        console.log("currency0:", c0);
        console.log("currency1:", c1);
        console.log("fee:", parsed.args.fee.toString());
        console.log("tickSpacing:", parsed.args.tickSpacing.toString());
        console.log("hooks:", parsed.args.hooks);
        console.log("sqrtPriceX96:", parsed.args.sqrtPriceX96.toString());
        console.log("tick:", parsed.args.tick.toString());
        console.log("============================");
        console.log("");
      }
    }
  }

  console.log("");
  console.log("=== RESULT ===");
  console.log("Matching USDG pools:", matches);

  if (matches === 0) {
    console.log("NO USDG POOL FOUND");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
