import { createPublicClient, http, encodeFunctionData, parseAbi } from "viem";

const RPC = "https://aelvoramarket.com/rpc";

const client = createPublicClient({
  transport: http(RPC),
});

const ROUTER = "0xcaf681a66d020601342297493863e78c959e5cb2";
const TOKEN = "0x344Cdc7a6A8B7A1e65fEE62284CA240eD52b8FB7";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const ACCOUNT = "0x7Dfa3B07b06B969c11FA93f581FccAA8F7bda02f";

const amount = 12832477169831629885800n;
const fee = 100;

const ABI = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
  "function unwrapWETH9(uint256 amountMinimum,address recipient) payable",
  "function multicall(bytes[] data) payable returns (bytes[] results)"
]);

const swapData = encodeFunctionData({
  abi: ABI,
  functionName: "exactInputSingle",
  args: [{
    tokenIn: TOKEN,
    tokenOut: WETH,
    fee,
    recipient: ROUTER,
    amountIn: amount,
    amountOutMinimum: 0n,
    sqrtPriceLimitX96: 0n,
  }],
});

const unwrapData = encodeFunctionData({
  abi: ABI,
  functionName: "unwrapWETH9",
  args: [0n, ACCOUNT],
});

const data = encodeFunctionData({
  abi: ABI,
  functionName: "multicall",
  args: [[swapData, unwrapData]],
});

try {
  const result = await client.call({
    to: ROUTER,
    data,
    account: ACCOUNT,
  });

  console.log("SUCCESS");
  console.log(result);
} catch (e) {
  console.log("FAILED");
  console.log(e.shortMessage || e.message);
  if (e.cause) console.log("CAUSE:", e.cause.shortMessage || e.cause.message);
}
