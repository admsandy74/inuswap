const hre = require("hardhat");

async function main() {
  const [d] = await hre.ethers.getSigners();
  const pm = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
  const fr = "0x0A280CA771f5fEfb765DC419F561001713B91fB9";

  console.log("Deployer:", d.address);
  console.log("PoolManager:", pm);
  console.log("FeeRecipient:", fr);

  const R = await hre.ethers.getContractFactory("AelvoraSwapRouter");
  const r = await R.deploy(pm, fr);
  await r.waitForDeployment();

  const a = await r.getAddress();
  console.log("Router:", a);
  console.log("TX:", r.deploymentTransaction().hash);

  console.log("On-chain PoolManager:", await r.poolManager());
  console.log("On-chain FeeRecipient:", await r.feeRecipient());
  console.log("On-chain Fee BPS:", (await r.SWAP_FEE_BPS()).toString());
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
