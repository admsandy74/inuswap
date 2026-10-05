const hre = require("hardhat");

async function main() {
  const provider = hre.ethers.provider;

  const router = new hre.ethers.Contract(
    "0x698e944AC6190b00563871b9760664dD6FE3e4fb",
    [
      "function swapExactETHForTokens((address,address,uint24,int24,address),bool,uint128,address) payable"
    ],
    provider
  );

  const poolKey = [
    "0x0000000000000000000000000000000000000000",
    "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    500,
    10,
    "0x0000000000000000000000000000000000000000"
  ];

  const testInput = 500000000000000n; // 0.001 ETH

  const fee = testInput * 10n / 10000n;
  const netInput = testInput - fee;

  const quote = new hre.ethers.Contract(
    "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
    [
      "function quoteExactInputSingle(((address,address,uint24,int24,address),bool,uint128,bytes)) returns (uint256,uint256)"
    ],
    provider
  );

  const q = await quote.quoteExactInputSingle.staticCall([
    poolKey,
    true,
    netInput,
    "0x"
  ]);

  console.log("=== READ-ONLY ROUTER CHECK ===");
  console.log("Router:", await router.getAddress());
  console.log("Input ETH:", testInput.toString());
  console.log("Fee:", fee.toString());
  console.log("Net to V4:", netInput.toString());
  console.log("Expected USDG:", q[0].toString());
  console.log("Expected gas:", q[1].toString());

  const calldata =
    router.interface.encodeFunctionData(
      "swapExactETHForTokens",
      [
        poolKey,
        true,
        q[0],
        "0x93FbC070164572A3aa1D5d3d119F17E1Da424079"
      ]
    );

  const result = await provider.call({
    to: await router.getAddress(),
    from: "0x93FbC070164572A3aa1D5d3d119F17E1Da424079",
    data: calldata,
    value: testInput
  });

  console.log("Router eth_call result:", result);
  console.log("ROUTER SIMULATION PASSED");
}

main().catch((e) => {
  console.error("ROUTER SIMULATION FAILED");
  console.error(e);
  process.exitCode = 1;
});
