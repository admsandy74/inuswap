const hre = require("hardhat");

const ROUTER =
  "0x698e944AC6190b00563871b9760664dD6FE3e4fb";

const EXPECTED_POOL_MANAGER =
  "0x8366a39CC670B4001A1121B8F6A443A643e40951";

const EXPECTED_FEE_RECIPIENT =
  "0x0A280CA771f5fEfb765DC419F561001713B91fB9";

const ROUTER_ABI = [
  "function poolManager() view returns (address)",
  "function feeRecipient() view returns (address)",
  "function SWAP_FEE_BPS() view returns (uint256)",
  "function BPS() view returns (uint256)",
  "function swapExactETHForTokens((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),bool,uint128,address) payable",
  "function swapExactTokensForTokens((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),bool,uint128,uint128,address)",
];

async function main() {
  console.log("=== AELVORA SWAP ROUTER LIVE AUDIT ===");

  const provider = hre.ethers.provider;
  const code = await provider.getCode(ROUTER);

  console.log("Router:", ROUTER);
  console.log("Bytecode exists:", code !== "0x");
  console.log("Bytecode length:", (code.length - 2) / 2, "bytes");

  if (code === "0x") {
    throw new Error("Router bytecode not found");
  }

  const router = new hre.ethers.Contract(
    ROUTER,
    ROUTER_ABI,
    provider
  );

  const poolManager = await router.poolManager();
  const feeRecipient = await router.feeRecipient();
  const swapFeeBps = await router.SWAP_FEE_BPS();
  const bps = await router.BPS();

  console.log("");
  console.log("PoolManager on-chain :", poolManager);
  console.log("Expected PoolManager  :", EXPECTED_POOL_MANAGER);
  console.log(
    "PoolManager MATCH      :",
    poolManager.toLowerCase() === EXPECTED_POOL_MANAGER.toLowerCase()
  );

  console.log("");
  console.log("Fee recipient on-chain:", feeRecipient);
  console.log("Expected fee recipient :", EXPECTED_FEE_RECIPIENT);
  console.log(
    "Fee recipient MATCH    :",
    feeRecipient.toLowerCase() === EXPECTED_FEE_RECIPIENT.toLowerCase()
  );

  console.log("");
  console.log("SWAP_FEE_BPS:", swapFeeBps.toString());
  console.log("BPS:", bps.toString());

  console.log("");
  console.log("=== FUNCTION EXISTENCE ===");

  const selectors = {
    swapExactETHForTokens:
      hre.ethers.id(
        "swapExactETHForTokens((address,address,uint24,int24,address),bool,uint128,address)"
      ).slice(0, 10),

    swapExactTokensForTokens:
      hre.ethers.id(
        "swapExactTokensForTokens((address,address,uint24,int24,address),bool,uint128,uint128,address)"
      ).slice(0, 10),
  };

  for (const [name, selector] of Object.entries(selectors)) {
    const found = code.toLowerCase().includes(selector.slice(2).toLowerCase());

    console.log(
      `${name}:`,
      found ? "FOUND ✅" : "NOT FOUND ❌",
      `selector=${selector}`
    );

    if (!found) {
      throw new Error(`${name} selector not found in deployed bytecode`);
    }
  }

  if (
    poolManager.toLowerCase() !== EXPECTED_POOL_MANAGER.toLowerCase()
  ) {
    throw new Error("PoolManager mismatch");
  }

  if (
    feeRecipient.toLowerCase() !== EXPECTED_FEE_RECIPIENT.toLowerCase()
  ) {
    throw new Error("Fee recipient mismatch");
  }

  if (swapFeeBps !== 10n) {
    throw new Error("Unexpected SWAP_FEE_BPS");
  }

  if (bps !== 10000n) {
    throw new Error("Unexpected BPS");
  }

  console.log("");
  console.log("=== RESULT ===");
  console.log("ROUTER LIVE AUDIT PASSED ✅");
}

main().catch((err) => {
  console.error("");
  console.error("ROUTER LIVE AUDIT FAILED ❌");
  console.error(err);
  process.exit(1);
});
