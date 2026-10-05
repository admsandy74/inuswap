const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ROOT = path.resolve(__dirname, "..");
const C = path.join(ROOT, "contracts");
const S = path.join(ROOT, "scripts");

let pass = 0;
let fail = 0;

function PASS(msg) {
  console.log(`PASS  ${msg}`);
  pass++;
}

function FAIL(msg) {
  console.log(`FAIL  ${msg}`);
  fail++;
}

function CHECK(condition, msg) {
  condition ? PASS(msg) : FAIL(msg);
}

function read(file) {
  if (!fs.existsSync(file)) {
    FAIL(`Missing file: ${path.relative(ROOT, file)}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function norm(x) {
  return String(x).toLowerCase();
}

function abiInputType(input) {
  if (input.type !== "tuple" && input.type !== "tuple[]") {
    return input.type;
  }

  return `tuple(${(input.components || [])
    .map((x) => x.type)
    .join(",")})`;
}

function abiSig(item) {
  return `${item.type}:${item.name || ""}(${(item.inputs || [])
    .map(abiInputType)
    .join(",")})`;
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log(" AELVORA FACTORY V2 — FIXED AUDIT");
  console.log("========================================");
  console.log("");

  const v1Factory = read(
    path.join(C, "AelvoraFactory.sol")
  );

  const v2Factory = read(
    path.join(C, "AelvoraFactoryV2.sol")
  );

  const v1Token = read(
    path.join(C, "AelvoraToken.sol")
  );

  const v2Token = read(
    path.join(C, "AelvoraTokenV2.sol")
  );

  const curve = read(
    path.join(C, "AelvoraBondingCurve.sol")
  );

  const migrator = read(
    path.join(C, "AelvoraV4Migrator.sol")
  );

  const deploy = read(
    path.join(S, "deploy-mainnet.cjs")
  );

  // ==========================================================
  // FILES
  // ==========================================================

  CHECK(!!v1Factory, "V1 Factory exists");
  CHECK(!!v2Factory, "V2 Factory exists");
  CHECK(!!v1Token, "V1 Token exists");
  CHECK(!!v2Token, "V2 Token exists");
  CHECK(!!curve, "BondingCurve exists");
  CHECK(!!migrator, "V4Migrator exists");
  CHECK(!!deploy, "Deployment script exists");

  // ==========================================================
  // V1 CORE FACTORY LOGIC
  // ==========================================================

  const requiredFactoryTerms = [
    "LAUNCH_FEE",
    "MAX_TOTAL_SUPPLY",
    "MAX_CREATOR_TAX_BPS",
    "launchFeeRecipient",
    "tradingFeeRecipient",
    "v4PoolManager",
    "permanentOwner",
    "creatorFeeVault",
    "allTokens",
    "tokenInfo",
    "isCurve",
    "TokenInfo",
    "IncorrectLaunchFee",
    "InvalidSupply",
    "InvalidCreatorTax",
    "ZeroAddress",
    "LaunchFeeTransferFailed",
    "InvalidFirstBuy",
    "TokenCreated",
    "_deployToken",
    "buyFor",
    "initializeLiquidity",
    "setMigrator",
    "registerCurve",
  ];

  for (const term of requiredFactoryTerms) {
    CHECK(
      v2Factory.includes(term),
      `V1 Factory logic preserved: ${term}`
    );
  }

  // ==========================================================
  // EXACT CONSTANTS
  // ==========================================================

  CHECK(
    /LAUNCH_FEE\s*=\s*0\.0003\s*ether/.test(v2Factory),
    "LAUNCH_FEE = 0.0003 ETH"
  );

  CHECK(
    /MAX_TOTAL_SUPPLY\s*=\s*1_000_000_000_000\s*\*\s*10\s*\*\*\s*18/.test(v2Factory),
    "MAX_TOTAL_SUPPLY = 1 trillion"
  );

  CHECK(
    /MAX_CREATOR_TAX_BPS\s*=\s*500/.test(v2Factory),
    "MAX_CREATOR_TAX_BPS = 500 (5%)"
  );

  // ==========================================================
  // DEPLOYMENT ADDRESS CHECK
  // IMPORTANT: addresses belong in deployment script,
  // not necessarily Factory source.
  // ==========================================================

  const expectedAddresses = {
    LAUNCH_FEE_RECIPIENT:
      "0x75042Ab64A436C42C840A65A67245174A6F7fD68",

    TRADING_FEE_RECIPIENT:
      "0x42E6965d3DF3feD36d52212F8668AbD04f93f55b",

    V4_POOL_MANAGER:
      "0x8366a39CC670B4001A1121B8F6A443A643e40951",

    PERMANENT_OWNER:
      "0x93FbC070164572A3aa1D5d3d119F17E1Da424079",
  };

  for (const [name, address] of Object.entries(
    expectedAddresses
  )) {
    CHECK(
      norm(deploy).includes(norm(address)),
      `${name} preserved in deployment config`
    );
  }

  // ==========================================================
  // V2 METADATA
  // ==========================================================

  CHECK(
    v2Factory.includes("MAX_METADATA_LENGTH"),
    "Factory V2 metadata length limit exists"
  );

  for (const field of [
    "website",
    "twitter",
    "telegram",
    "logoURI",
  ]) {
    CHECK(
      v2Factory.includes(field),
      `Factory V2 metadata field: ${field}`
    );

    CHECK(
      v2Token.includes(field),
      `Token V2 metadata field: ${field}`
    );
  }

  // ==========================================================
  // TOKEN V2 CORE
  // ==========================================================

  for (const term of [
    "MAX_CREATOR_TAX_BPS",
    "PLATFORM_FEE_BPS",
    "creator",
    "tradingFeeRecipient",
    "creatorFeeVault",
    "creatorTaxBps",
    "creatorRewards",
    "_mint",
  ]) {
    CHECK(
      v2Token.includes(term),
      `Token V1 logic preserved: ${term}`
    );
  }

  // ==========================================================
  // NO METADATA SETTERS
  // ==========================================================

  const forbidden = [
    "setWebsite",
    "setTwitter",
    "setTelegram",
    "setLogoURI",
    "updateWebsite",
    "updateTwitter",
    "updateTelegram",
    "updateLogoURI",
  ];

  for (const fn of forbidden) {
    CHECK(
      !new RegExp(`function\\s+${fn}\\s*\\(`, "i").test(v2Token),
      `No metadata setter: ${fn}()`
    );
  }

  // ==========================================================
  // FACTORY MUST DEPLOY TOKEN V2
  // ==========================================================

  CHECK(
    v2Factory.includes(
      'import "./AelvoraTokenV2.sol";'
    ),
    "Factory imports AelvoraTokenV2"
  );

  CHECK(
    v2Factory.includes("new AelvoraTokenV2"),
    "Factory deploys AelvoraTokenV2"
  );

  // ==========================================================
  // INITIAL BUY + LAUNCH FEE
  // ==========================================================

  CHECK(
    v2Factory.includes("firstBuyEth"),
    "firstBuyEth preserved"
  );

  CHECK(
    /buyFor\s*\{value:\s*p\.firstBuyEth\}/.test(
      v2Factory
    ),
    "Initial buy execution preserved"
  );

  CHECK(
    /msg\.value\s*!=\s*LAUNCH_FEE\s*\+\s*p\.firstBuyEth/.test(
      v2Factory
    ),
    "Total ETH validation preserved"
  );

  CHECK(
    /value:\s*LAUNCH_FEE/.test(v2Factory),
    "Launch fee transfer preserved"
  );

  // ==========================================================
  // METADATA MUST BE PASSED TO TOKEN CONSTRUCTOR
  // ==========================================================

  for (const field of [
    "p.website",
    "p.twitter",
    "p.telegram",
    "p.logoURI",
  ]) {
    CHECK(
      v2Factory.includes(field),
      `Factory passes ${field} to Token V2`
    );
  }

  // ==========================================================
  // CURVE / MIGRATOR MUST NOT HAVE METADATA CHANGES
  // ==========================================================

  for (const field of [
    "website",
    "twitter",
    "telegram",
    "logoURI",
  ]) {
    CHECK(
      !curve.includes(field),
      `BondingCurve untouched: ${field}`
    );

    CHECK(
      !migrator.includes(field),
      `V4Migrator untouched: ${field}`
    );
  }

  // ==========================================================
  // COMPILE
  // ==========================================================

  console.log("");
  console.log("Compiling...");
  console.log("");

  await hre.run("compile");

  PASS("Hardhat compilation succeeded");

  // ==========================================================
  // ABI AUDIT
  // ==========================================================

  const v1Artifact =
    await hre.artifacts.readArtifact(
      "AelvoraFactory"
    );

  const v2Artifact =
    await hre.artifacts.readArtifact(
      "AelvoraFactoryV2"
    );

  const v1Abi = v1Artifact.abi;
  const v2Abi = v2Artifact.abi;

  const v1FunctionsEvents = v1Abi.filter(
    (x) =>
      x.type === "function" ||
      x.type === "event"
  );

  const v2FunctionsEvents = v2Abi.filter(
    (x) =>
      x.type === "function" ||
      x.type === "event"
  );

  const v2Set = new Set(
    v2FunctionsEvents.map(abiSig)
  );

  for (const item of v1FunctionsEvents) {
    const sig = abiSig(item);

    // createToken signature intentionally changes
    // from 5 args to V2 tuple.
    if (
      item.type === "function" &&
      item.name === "createToken"
    ) {
      continue;
    }

    CHECK(
      v2Set.has(sig),
      `V1 ABI preserved: ${sig}`
    );
  }

  // ==========================================================
  // V2 CREATE TOKEN EXACT STRUCT
  // ==========================================================

  const createV2 = v2Abi.find(
    (x) =>
      x.type === "function" &&
      x.name === "createToken"
  );

  CHECK(
    !!createV2,
    "V2 createToken exists"
  );

  const input = createV2?.inputs?.[0];

  CHECK(
    input?.type === "tuple",
    "V2 createToken uses tuple"
  );

  const components =
    input?.components || [];

  const expectedComponents = [
    ["name", "string"],
    ["symbol", "string"],
    ["totalSupply", "uint256"],
    ["creatorTaxBps", "uint256"],
    ["firstBuyEth", "uint256"],
    ["website", "string"],
    ["twitter", "string"],
    ["telegram", "string"],
    ["logoURI", "string"],
  ];

  CHECK(
    components.length === expectedComponents.length,
    "V2 createToken has exactly 9 fields"
  );

  for (let i = 0; i < expectedComponents.length; i++) {
    const [name, type] =
      expectedComponents[i];

    CHECK(
      components[i]?.name === name &&
      components[i]?.type === type,
      `V2 field ${i + 1}: ${name} (${type})`
    );
  }

  // ==========================================================
  // TOKEN V2 ABI GETTERS
  // ==========================================================

  const tokenArtifact =
    await hre.artifacts.readArtifact(
      "AelvoraTokenV2"
    );

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

    CHECK(
      found,
      `On-chain getter exists: ${getter}()`
    );
  }

  // ==========================================================
  // TOKEN V2 MUST NOT HAVE OWNERSHIP
  // ==========================================================

  for (const fn of [
    "owner",
    "transferOwnership",
    "renounceOwnership",
  ]) {
    CHECK(
      !tokenAbi.some(
        (x) =>
          x.type === "function" &&
          x.name === fn
      ),
      `Token V2 has no ${fn}()`
    );
  }

  // ==========================================================
  // RESULT
  // ==========================================================

  console.log("");
  console.log("========================================");
  console.log(" FINAL AUDIT");
  console.log("========================================");
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);
  console.log("");

  if (fail > 0) {
    console.log(
      "AUDIT FAILED — DO NOT DEPLOY."
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "AUDIT PASSED — FACTORY V2 READY."
  );
}

main().catch((err) => {
  console.error("");
  console.error("AUDIT ERROR:");
  console.error(err);
  process.exitCode = 1;
});
