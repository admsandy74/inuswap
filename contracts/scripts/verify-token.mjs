import fs from "fs";
import path from "path";
import {
  createPublicClient,
  http,
  parseAbi,
  encodeAbiParameters,
} from "viem";

const CHAIN_ID = 4663;
const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
const API_URL = "https://api.etherscan.io/v2/api";

const TOKEN_ADDRESS = process.argv[2];

if (!TOKEN_ADDRESS) {
  console.error("Usage: node scripts/verify-token.mjs <TOKEN_ADDRESS>");
  process.exit(1);
}

const API_KEY_FILE = path.join(
  process.env.HOME,
  ".aelvora-verify.env"
);

let API_KEY = process.env.ETHERSCAN_API_KEY || null;

if (!API_KEY && fs.existsSync(API_KEY_FILE)) {
  const envText = fs.readFileSync(API_KEY_FILE, "utf8");
  const match = envText.match(/^ETHERSCAN_API_KEY=(.+)$/m);

  if (match) {
    API_KEY = match[1].trim();
  }
}

if (!API_KEY) {
  console.error("ETHERSCAN_API_KEY is not configured.");
  console.error("");
  console.error("Configure it with:");
  console.error(
    'read -rsp "Enter Etherscan API key: " KEY; echo; printf "ETHERSCAN_API_KEY=%s\\n" "$KEY" > ~/.aelvora-verify.env; chmod 600 ~/.aelvora-verify.env'
  );
  process.exit(1);
}

const BUILD_INFO_PATH =
  "artifacts/build-info/5e04678cab3d369d31a163bee6ed8a73.json";

if (!fs.existsSync(BUILD_INFO_PATH)) {
  console.error(
    `Build info file not found: ${BUILD_INFO_PATH}`
  );
  process.exit(1);
}

const buildInfo = JSON.parse(
  fs.readFileSync(BUILD_INFO_PATH, "utf8")
);

const sourceCode = JSON.stringify(buildInfo.input);

const client = createPublicClient({
  transport: http(RPC_URL),
});

const tokenAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function creator() view returns (address)",
  "function tradingFeeRecipient() view returns (address)",
  "function creatorFeeVault() view returns (address)",
]);

console.log("========================================");
console.log(" AELVORA CONTRACT VERIFIER");
console.log("========================================");
console.log(`Token Address: ${TOKEN_ADDRESS}`);
console.log(`Chain ID: ${CHAIN_ID}`);
console.log("");

/*
 * Step 1:
 * Check whether the contract is already verified.
 */
console.log("[1/4] Checking current verification status...");

const statusUrl = new URL(API_URL);

statusUrl.searchParams.set(
  "chainid",
  String(CHAIN_ID)
);

statusUrl.searchParams.set(
  "module",
  "contract"
);

statusUrl.searchParams.set(
  "action",
  "getsourcecode"
);

statusUrl.searchParams.set(
  "address",
  TOKEN_ADDRESS
);

statusUrl.searchParams.set(
  "apikey",
  API_KEY
);

const statusResponse = await fetch(statusUrl);
const statusData = await statusResponse.json();

const currentContract =
  statusData?.result?.[0];

if (
  statusData?.status === "1" &&
  currentContract &&
  currentContract.SourceCode
) {
  console.log("Contract is already verified.");
  console.log(
    `Contract Name: ${currentContract.ContractName}`
  );
  console.log(
    `Compiler Version: ${currentContract.CompilerVersion}`
  );
  console.log("");
  console.log(
    `https://robin.etherscan.io/address/${TOKEN_ADDRESS}#code`
  );
  process.exit(0);
}

/*
 * Step 2:
 * Read the constructor values directly from the deployed contract.
 */
console.log(
  "[2/4] Reading constructor values from the blockchain..."
);

const [
  name,
  symbol,
  totalSupply,
  creatorTaxBps,
  creator,
  tradingFeeRecipient,
  creatorFeeVault,
] = await Promise.all([
  client.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "name",
  }),

  client.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "symbol",
  }),

  client.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "totalSupply",
  }),

  client.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "creatorTaxBps",
  }),

  client.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "creator",
  }),

  client.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "tradingFeeRecipient",
  }),

  client.readContract({
    address: TOKEN_ADDRESS,
    abi: tokenAbi,
    functionName: "creatorFeeVault",
  }),
]);

console.log(`Name: ${name}`);
console.log(`Symbol: ${symbol}`);
console.log(
  `Total Supply: ${totalSupply.toString()}`
);
console.log(
  `Creator Tax BPS: ${creatorTaxBps.toString()}`
);
console.log(`Creator: ${creator}`);
console.log(
  `Trading Fee Recipient: ${tradingFeeRecipient}`
);
console.log(
  `Creator Fee Vault: ${creatorFeeVault}`
);
console.log("");

/*
 * Encode the complete constructor arguments.
 */
const constructorArguments =
  encodeAbiParameters(
    [
      { type: "string" },
      { type: "string" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "address" },
      { type: "address" },
      { type: "address" },
    ],
    [
      name,
      symbol,
      totalSupply,
      creatorTaxBps,
      creator,
      tradingFeeRecipient,
      creatorFeeVault,
    ]
  ).slice(2);

console.log("Encoded Constructor Arguments:");
console.log(constructorArguments);
console.log("");

/*
 * Step 3:
 * Submit the Solidity Standard JSON Input for verification.
 */
console.log("[3/4] Submitting contract verification...");

const requestBody = new URLSearchParams();

requestBody.set(
  "module",
  "contract"
);

requestBody.set(
  "action",
  "verifysourcecode"
);

requestBody.set(
  "contractaddress",
  TOKEN_ADDRESS
);

requestBody.set(
  "sourceCode",
  sourceCode
);

requestBody.set(
  "codeformat",
  "solidity-standard-json-input"
);

requestBody.set(
  "contractname",
  "contracts/AelvoraToken.sol:AelvoraToken"
);

requestBody.set(
  "compilerversion",
  "v0.8.26+commit.8a97fa7a"
);

requestBody.set(
  "optimizationUsed",
  "1"
);

requestBody.set(
  "runs",
  "200"
);

requestBody.set(
  "evmversion",
  "cancun"
);

requestBody.set(
  "constructorArguments",
  constructorArguments
);

requestBody.set(
  "licenseType",
  "3"
);

const verifyUrl = new URL(API_URL);

verifyUrl.searchParams.set(
  "chainid",
  String(CHAIN_ID)
);

verifyUrl.searchParams.set(
  "apikey",
  API_KEY
);

const verifyResponse = await fetch(
  verifyUrl,
  {
    method: "POST",
    headers: {
      "Content-Type":
        "application/x-www-form-urlencoded",
    },
    body: requestBody,
  }
);

const verifyData =
  await verifyResponse.json();

console.log("Verification submission response:");
console.log(
  JSON.stringify(
    verifyData,
    null,
    2
  )
);
console.log("");

if (!verifyData?.result) {
  console.error(
    "Verification submission failed."
  );
  process.exit(1);
}

const guid = verifyData.result;

if (
  typeof guid === "string" &&
  guid.toLowerCase().includes(
    "already verified"
  )
) {
  console.log(
    "Contract is already verified."
  );
  process.exit(0);
}

console.log(
  `Verification GUID: ${guid}`
);
console.log("");

/*
 * Step 4:
 * Poll the verification status.
 */
console.log(
  "[4/4] Checking verification status..."
);

for (let attempt = 1; attempt <= 30; attempt++) {
  await new Promise((resolve) =>
    setTimeout(resolve, 5000)
  );

  const checkUrl =
    new URL(API_URL);

  checkUrl.searchParams.set(
    "chainid",
    String(CHAIN_ID)
  );

  checkUrl.searchParams.set(
    "module",
    "contract"
  );

  checkUrl.searchParams.set(
    "action",
    "checkverifystatus"
  );

  checkUrl.searchParams.set(
    "guid",
    guid
  );

  checkUrl.searchParams.set(
    "apikey",
    API_KEY
  );

  const checkResponse =
    await fetch(checkUrl);

  const checkData =
    await checkResponse.json();

  const resultText = String(
    checkData?.result ??
      checkData?.message ??
      ""
  );

  console.log(
    `[${attempt}/30] ${resultText}`
  );

  const normalized =
    resultText.toLowerCase();

  if (
    normalized.includes("pass")
  ) {
    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      " VERIFICATION SUCCESSFUL"
    );
    console.log(
      "========================================"
    );
    console.log(
      `https://robin.etherscan.io/address/${TOKEN_ADDRESS}#code`
    );
    process.exit(0);
  }

  if (
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("unable")
  ) {
    console.error("");
    console.error(
      "VERIFICATION FAILED."
    );
    process.exit(1);
  }
}

console.error("");
console.error(
  "Verification status check timed out."
);
process.exit(1);
