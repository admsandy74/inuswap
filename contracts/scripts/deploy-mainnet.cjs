const hre = require("hardhat");

const LAUNCH_FEE_RECIPIENT =
  "0x75042Ab64A436C42C840A65A67245174A6F7fD68";

const TRADING_FEE_RECIPIENT =
  "0x42E6965d3DF3feD36d52212F8668AbD04f93f55b";

const V4_POOL_MANAGER =
  "0x8366a39CC670B4001A1121B8F6A443A643e40951";

const PERMANENT_OWNER =
  "0x93FbC070164572A3aa1D5d3d119F17E1Da424079";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("========================================");
  console.log("AELVORA MAINNET DEPLOY");
  console.log("========================================");
  console.log("Deployer:            ", deployer.address);
  console.log("Launch fee recipient:", LAUNCH_FEE_RECIPIENT);
  console.log("Trading fee recipient:", TRADING_FEE_RECIPIENT);
  console.log("V4 PoolManager:      ", V4_POOL_MANAGER);
  console.log("Permanent owner:      ", PERMANENT_OWNER);
  console.log("========================================");

  const network = await hre.ethers.provider.getNetwork();
  console.log("Chain ID:", network.chainId.toString());

  if (network.chainId !== 4663n) {
    throw new Error(
      `WRONG NETWORK. Expected Robinhood Chain 4663, got ${network.chainId}`
    );
  }

  const balance =
    await hre.ethers.provider.getBalance(deployer.address);

  console.log(
    "Deployer balance:",
    hre.ethers.formatEther(balance),
    "ETH"
  );

  if (balance === 0n) {
    throw new Error("Deployer has 0 ETH for gas.");
  }

  console.log("\nDeploying AelvoraFactoryV2...");

  const Factory = await hre.ethers.getContractFactory(
    "AelvoraFactoryV2"
  );

  const factory = await Factory.deploy(
    LAUNCH_FEE_RECIPIENT,
    TRADING_FEE_RECIPIENT,
    V4_POOL_MANAGER,
    PERMANENT_OWNER
  );

  console.log("Factory tx:", factory.deploymentTransaction().hash);

  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();

  console.log("\n========================================");
  console.log("DEPLOYMENT SUCCESS");
  console.log("========================================");
  console.log("AelvoraFactoryV2:", factoryAddress);
  console.log("========================================");

  console.log("\nFactory configuration:");
  console.log(
    "launchFeeRecipient :",
    await factory.launchFeeRecipient()
  );
  console.log(
    "tradingFeeRecipient:",
    await factory.tradingFeeRecipient()
  );
  console.log(
    "v4PoolManager      :",
    await factory.v4PoolManager()
  );
  console.log(
    "permanentOwner     :",
    await factory.permanentOwner()
  );
  console.log(
    "creatorFeeVault    :",
    await factory.creatorFeeVault()
  );

  console.log("\nSAVE THESE ADDRESSES:");
  console.log(`AELVORA_FACTORY=${factoryAddress}`);
  console.log(
    `AELVORA_CREATOR_FEE_VAULT=${await factory.creatorFeeVault()}`
  );
}

main().catch((error) => {
  console.error("\nDEPLOY FAILED:");
  console.error(error);
  process.exitCode = 1;
});
