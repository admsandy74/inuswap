const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;

  const pm = "0x8366a39CC670B4001A1121B8F6A443A643e40951";

  const abi = [
    "event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)"
  ];

  const c = new hre.ethers.Contract(pm, abi, provider);

  const filter = c.filters.Initialize(
    "0x387bf619da4d3fb62bb276482693dba1b9b3520f573cabdfe033384a24125982"
  );

  const logs = await c.queryFilter(filter, 0, "latest");

  console.log("Initialize logs:", logs.length);

  for (const log of logs) {
    console.log("\n=== POOL INITIALIZE ===");
    console.log("Block:", log.blockNumber);
    console.log("TX:", log.transactionHash);
    console.log("Pool ID:", log.args.id);
    console.log("Currency0:", log.args.currency0);
    console.log("Currency1:", log.args.currency1);
    console.log("Fee:", log.args.fee.toString());
    console.log("Tick spacing:", log.args.tickSpacing.toString());
    console.log("Hooks:", log.args.hooks);
    console.log("sqrtPriceX96:", log.args.sqrtPriceX96.toString());
    console.log("Tick:", log.args.tick.toString());
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
