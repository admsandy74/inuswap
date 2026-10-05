const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ROOT = path.resolve(__dirname, "..");
const CONTRACTS = path.join(ROOT, "contracts");

const V1_FACTORY = path.join(CONTRACTS, "AelvoraFactory.sol");
const V2_FACTORY = path.join(CONTRACTS, "AelvoraFactoryV2.sol");
const V1_TOKEN = path.join(CONTRACTS, "AelvoraToken.sol");
const V2_TOKEN = path.join(CONTRACTS, "AelvoraTokenV2.sol");
const CURVE = path.join(CONTRACTS, "AelvoraBondingCurve.sol");
const MIGRATOR = path.join(CONTRACTS, "AelvoraV4Migrator.sol");

const EXPECTED = {
  LAUNCH_FEE_RECIPIENT:
    "0x75042Ab64A436C42C840A65A67245174A6F7fD68",

  TRADING_FEE_RECIPIENT:
    "0x42E6965d3DF3feD36d52212F8668AbD04f93f55b",

  V4_POOL_MANAGER:
    "0x8366a39CC670B4001A1121B8F6A443A643e40951",

  PERMANENT_OWNER:
    "0x93FbC070164572A3aa1D5d3d119F17E1Da424079",
};

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`PASS  ${msg}`);
  passed++;
}

function fail(msg) {
  console.log(`FAIL  ${msg}`);
  failed++;
}

function check(condition, msg) {
  if (condition) pass(msg);
  else fail(msg);
}

function read(file) {
  if (!fs.existsSync(file)) {
    fail(`File missing: ${path.relative(ROOT, file)}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function normalizeAddress(a) {
  return String(a).toLowerCase();
}

function abiSignature(item) {
  const inputs = (item.inputs || [])
    .map((x) => {
      if (x.type !== "tuple" && x.type !== "tuple[]") {
        return x.type;
      }

      const components = (x.components || [])
        .map((c) => c.type)
        .join(",");

      return `tuple(${components})`;
    })
    .join(",");

  return `${item.type}:${item.name || ""}(${inputs})`;
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log(" AELVORA FACTORY V2 AUDIT");
  console.log("========================================");
  console.log("");

  // ----------------------------------------------------------
  // 1. Files
  // ----------------------------------------------------------

  const v1Factory = read(V1_FACTORY);
  const v2Factory = read(V2_FACTORY);
  const v1Token = read(V1_TOKEN);
  const v2Token = read(V2_TOKEN);
  const curve = read(CURVE);
  const migrator = read(MIGRATOR);

  check(
    v1Factory.length > 0,
    "AelvoraFactory.sol exists"
  );

  check(
    v2Factory.length > 0,
    "AelvoraFactoryV2.sol exists"
  );

  check(
    v1Token.length > 0,
    "AelvoraToken.sol exists"
  );

  check(
    v2Token.length > 0,
    "AelvoraTokenV2.sol exists"
  );

  check(
    curve.length > 0,
    "AelvoraBondingCurve.sol exists"
  );

  check(
    migrator.length > 0,
    "AelvoraV4Migrator.sol exists"
  );

  // ----------------------------------------------------------
  // 2. V1 critical logic must remain in V2
  // ----------------------------------------------------------

  const criticalV1 = [
    "LAUNCH_FEE",
    "MAX_TOTAL_SUPPLY",
    "MAX_CREATOR_TAX_BPS",
    "launchFeeRecipient",
    "tradingFeeRecipient",
    "v4PoolManager",
    "permanentOwner",
    "creatorFeeVault",
    "TokenInfo",
    "allTokens",
    "tokenInfo",
    "isCurve",
    "IncorrectLaunchFee",
    "InvalidSupply",
    "InvalidCreatorTax",
    "ZeroAddress",
    "LaunchFeeTransferFailed",
    "InvalidFirstBuy",
    "TokenCreated",
    "createToken",
    "_deployToken",
    "buyFor",
    "initializeLiquidity",
    "setMigrator",
    "registerCurve",
    "LAUNCH_FEE",
  ];

  for (const key of criticalV1) {
    check(
      v2Factory.includes(key),
      `V1 critical logic preserved: ${key}`
    );
  }

  // ----------------------------------------------------------
  // 3. Exact V1 fee / limits
  // ----------------------------------------------------------

  check(
    /LAUNCH_FEE\s*=\s*0\.0003\s*ether/.test(v2Factory),
    "Launch fee remains 0.0003 ETH"
  );

  check(
    /MAX_TOTAL_SUPPLY\s*=\s*1_000_000_000_000\s*\*\s*10\s*\*\*\s*18/.test(v2Factory),
    "Max supply remains 1 trillion tokens"
  );

  check(
    /MAX_CREATOR_TAX_BPS\s*=\s*500/.test(v2Factory),
    "Creator tax maximum remains 5%"
  );

  // ----------------------------------------------------------
  // 4. Exact V1 deployment addresses
  // ----------------------------------------------------------

  for (const [name, address] of Object.entries(EXPECTED)) {
    check(
      v2Factory.toLowerCase().includes(address.toLowerCase()),
      `${name} preserved: ${address}`
    );
  }

  // ----------------------------------------------------------
  // 5. Metadata
  // ----------------------------------------------------------

  check(
    v2Factory.includes("MAX_METADATA_LENGTH"),
    "Factory V2 has metadata length limit"
  );

  for (const field of [
    "website",
    "twitter",
    "telegram",
    "logoURI",
  ]) {
    check(
      v2Factory.includes(field),
      `Factory V2 contains metadata field: ${field}`
    );

    check(
      v2Token.includes(field),
      `Token V2 contains metadata field: ${field}`
    );
  }

  check(
    /string\s+website/.test(v2Token),
    "Token V2 stores website on-chain"
  );

  check(
    /string\s+twitter/.test(v2Token),
    "Token V2 stores twitter on-chain"
  );

  check(
    /string\s+telegram/.test(v2Token),
    "Token V2 stores telegram on-chain"
  );

  check(
    /string\s+logoURI/.test(v2Token),
    "Token V2 stores logoURI on-chain"
  );

  // ----------------------------------------------------------
  // 6. Token V2 must NOT have metadata setters
  // ----------------------------------------------------------

  const forbiddenSetterPatterns = [
    /function\s+setWebsite\s*\(/i,
    /function\s+setTwitter\s*\(/i,
    /function\s+setTelegram\s*\(/i,
    /function\s+setLogoURI\s*\(/i,
    /function\s+updateWebsite\s*\(/i,
    /function\s+updateTwitter\s*\(/i,
    /function\s+updateTelegram\s*\(/i,
    /function\s+updateLogoURI\s*\(/i,
  ];

  for (const pattern of forbiddenSetterPatterns) {
    check(
      !pattern.test(v2Token),
      `No mutable metadata setter: ${pattern}`
    );
  }

  // ----------------------------------------------------------
  // 7. Token V2 must still preserve V1 core token fields
  // ----------------------------------------------------------

  for (const field of [
    "MAX_CREATOR_TAX_BPS",
    "PLATFORM_FEE_BPS",
    "creator",
    "tradingFeeRecipient",
    "creatorFeeVault",
    "creatorTaxBps",
    "creatorRewards",
    "_mint",
  ]) {
    check(
      v2Token.includes(field),
      `Token V1 core preserved: ${field}`
    );
  }

  // ----------------------------------------------------------
  // 8. Factory V2 must use AelvoraTokenV2
  // ----------------------------------------------------------

  check(
    v2Factory.includes('import "./AelvoraTokenV2.sol";'),
    "Factory V2 imports AelvoraTokenV2"
  );

  check(
    v2Factory.includes("new AelvoraTokenV2"),
    "Factory V2 deploys AelvoraTokenV2"
  );

  // ----------------------------------------------------------
  // 9. Initial buy MUST remain
  // ----------------------------------------------------------

  check(
    v2Factory.includes("firstBuyEth"),
    "Factory V2 keeps firstBuyEth parameter"
  );

  check(
    v2Factory.includes("InvalidFirstBuy"),
    "Factory V2 keeps InvalidFirstBuy protection"
  );

  check(
    /buyFor\s*\{value:\s*p\.firstBuyEth\}/.test(v2Factory),
    "Factory V2 still executes initial buy"
  );

  // ----------------------------------------------------------
  // 10. Launch fee MUST remain
  // ----------------------------------------------------------

  check(
    /msg\.value\s*!=\s*LAUNCH_FEE\s*\+\s*p\.firstBuyEth/.test(v2Factory),
    "Factory V2 still validates total ETH"
  );

  check(
    /value:\s*LAUNCH_FEE/.test(v2Factory),
    "Factory V2 still transfers launch fee"
  );

  // ----------------------------------------------------------
  // 11. Curve / migrator source must contain no V2 metadata changes
  // ----------------------------------------------------------

  check(
    !curve.includes("website"),
    "BondingCurve untouched by metadata changes"
  );

  check(
    !curve.includes("twitter"),
    "BondingCurve untouched by metadata changes"
  );

  check(
    !curve.includes("telegram"),
    "BondingCurve untouched by metadata changes"
  );

  check(
    !migrator.includes("website"),
    "V4Migrator untouched by metadata changes"
  );

  check(
    !migrator.includes("twitter"),
    "V4Migrator untouched by metadata changes"
  );

  check(
    !migrator.includes("telegram"),
    "V4Migrator untouched by metadata changes"
  );

  // ----------------------------------------------------------
  // 12. Compile
  // ----------------------------------------------------------

  console.log("");
  console.log("Compiling contracts...");
  console.log("");

  await hre.run("compile");

  pass("Hardhat compilation succeeded");

  // ----------------------------------------------------------
  // 13. ABI compatibility audit
  // ----------------------------------------------------------

  const v1Artifact =
    await hre.artifacts.readArtifact("AelvoraFactory");

  const v2Artifact =
    await hre.artifacts.readArtifact("AelvoraFactoryV2");

  const v1Abi = v1Artifact.abi;
  const v2Abi = v2Artifact.abi;

  const v1Signatures = new Set(
    v1Abi
      .filter(
        (x) =>
          x.type === "function" ||
          x.type === "event"
      )
      .map(abiSignature)
  );

  const v2Signatures = new Set(
    v2Abi
      .filter(
        (x) =>
          x.type === "function" ||
          x.type === "event"
      )
      .map(abiSignature)
  );

  for (const sig of v1Signatures) {
    check(
      v2Signatures.has(sig),
      `Factory V1 ABI preserved: ${sig}`
    );
  }

  // V2-specific createToken must exist.
  check(
    v2Signatures.has(
      "function:createToken(tuple(string,string,uint256,uint256,uint256,string,string,string,string))"
    ),
    "Factory V2 createToken metadata tuple exists"
  );

  // ----------------------------------------------------------
  // 14. Token V2 ABI metadata getters
  // ----------------------------------------------------------

  const tokenArtifact =
    await hre.artifacts.readArtifact("AelvoraTokenV2");

  const tokenAbi = tokenArtifact.abi;

  for (const getter of [
    "website",
    "twitter",
    "telegram",
    "logoURI",
  ]) {
    const found = tokenAbi.some(
      (x) =>
        x.type === "function" &&
        x.name === getter &&
        x.stateMutability === "view"
    );

    check(
      found,
      `Token V2 immutable metadata getter exists: ${getter}()`
    );
  }

  // ----------------------------------------------------------
  // 15. No ownership/admin mechanism in Token V2
  // ----------------------------------------------------------

  check(
    !tokenAbi.some(
      (x) =>
        x.type === "function" &&
        [
          "owner",
          "transferOwnership",
          "renounceOwnership",
        ].includes(x.name)
    ),
    "Token V2 has no ownership/admin control"
  );

  // ----------------------------------------------------------
  // Summary
  // ----------------------------------------------------------

  console.log("");
  console.log("========================================");
  console.log(" AUDIT RESULT");
  console.log("========================================");
  console.log(`PASS: ${passed}`);
  console.log(`FAIL: ${failed}`);
  console.log("");

  if (failed > 0) {
    console.log("AUDIT FAILED — DO NOT DEPLOY FACTORY V2.");
    process.exitCode = 1;
    return;
  }

  console.log("AUDIT PASSED — FACTORY V2 READY FOR DEPLOYMENT.");
}

main().catch((err) => {
  console.error("");
  console.error("AUDIT ERROR:");
  console.error(err);
  process.exitCode = 1;
});
