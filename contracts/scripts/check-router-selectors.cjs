const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;

  const routerAddress =
    "0x698e944AC6190b00563871b9760664dD6FE3e4fb";

  const iface = new hre.ethers.Interface([
    "function swapExactETHForTokens((address,address,uint24,int24,address),bool,uint128,address) payable",
    "function swapExactTokensForTokens((address,address,uint24,int24,address),bool,uint128,uint128,address)"
  ]);

  const ethFn = iface.getFunction("swapExactETHForTokens");
  const tokenFn = iface.getFunction("swapExactTokensForTokens");

  const ethSelector = ethFn.selector;
  const tokenSelector = tokenFn.selector;

  const code = await provider.getCode(routerAddress);

  console.log("=== ROUTER SELECTOR CHECK ===");
  console.log("Router:", routerAddress);
  console.log("");
  console.log("ETH swap selector  :", ethSelector);
  console.log("TOKEN swap selector:", tokenSelector);
  console.log("");
  console.log(
    "ETH selector in bytecode  :",
    code.toLowerCase().includes(ethSelector.slice(2).toLowerCase())
  );
  console.log(
    "TOKEN selector in bytecode:",
    code.toLowerCase().includes(tokenSelector.slice(2).toLowerCase())
  );
  console.log("");
  console.log("Bytecode length:", (code.length - 2) / 2, "bytes");

  console.log("");
  console.log("=== ABI FRAGMENTS ===");
  console.log(ethFn.format());
  console.log(tokenFn.format());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
