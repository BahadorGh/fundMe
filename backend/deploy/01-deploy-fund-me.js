const { network, ethers, deployments } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
require("dotenv").config()
const path = require('path')
const fs = require('fs')

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    let ethUsdPriceFeedAddress
    let erc20RewardTokenAddress
    if (chainId == 1337) {
    // if (chainId == 31337) {
        const ethUsdAggregator = await deployments.get("MockV3Aggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address

        const rewardToken = await deployments.get("MockERC20Token")
        erc20RewardTokenAddress = rewardToken.address
    } else {
        ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
    }
    log("----------------------------------------------------")
    log("Deploying FundMe and waiting for confirmations...")
    const fundMe = await deploy("FundMe", {
        from: deployer,
        args: [ethUsdPriceFeedAddress, erc20RewardTokenAddress],
        log: true,
        // we need to wait if on a live network so we can verify properly
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    // await chargeFundMe(fundMe.address)
    log(`FundMe deployed at ${fundMe.address}`)
    // const fundme = await ethers.getContractAt("FundMe",fundMe.address,deployer)
    const myRewardToken = await ethers.getContractAt("RewardToken", erc20RewardTokenAddress, deployer)
    saveFrontendFiles(myRewardToken);
    const signer = await ethers.getSigners()
    const theOwner = signer[0]

    const abi = [
        {
            "inputs": [
                {
                "internalType": "address",
                "name": "to",
                "type": "address"
                },
                {
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
                }
            ],
            "name": "transfer",
            "outputs": [
                {
                "internalType": "bool",
                "name": "",
                "type": "bool"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ]
    let iface = new ethers.utils.Interface(abi)
    let encodedInputData = iface.encodeFunctionData(
        "transfer", [fundMe.address, "1000000000000000000"]
        );
    console.log("encodedInputData:", encodedInputData);

    const tx = {
        from: deployer,
        to: erc20RewardTokenAddress,
        data: encodedInputData
    }

    const receipt = await theOwner.sendTransaction(tx)
    await receipt.wait()
    console.log("Hash of transfer:", receipt.hash);
    console.log(`${fundMe.address} Funded!`)
    console.log(`FundMe current balance of reward token: ${ethers.utils.formatEther(await myRewardToken.balanceOf(fundMe.address))} ${await myRewardToken.symbol()} `)
    console.log(`Owner balance of RewardToken: ${ethers.utils.formatEther(await myRewardToken.balanceOf(deployer))} ${await myRewardToken.symbol()} `)



    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        await verify(fundMe.address, [ethUsdPriceFeedAddress])
    }
}

function saveFrontendFiles(myContract) {
  // const fs = require("fs");
  const contractsDir = path.join(
    __dirname,
    "..",
    "..",
    "/frontend",
    "src",
    "constants"
  );

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify({ ["contractAddress"]: myContract.address }, undefined, 2)
  );

  const ContractArtifact = artifacts.readArtifactSync("RewardToken");

  fs.writeFileSync(
    path.join(contractsDir, "contractAbi.json"),
    JSON.stringify(ContractArtifact, null, 2)
  );
}

module.exports.tags = ["all", "fundme"]
module.exports.dependencies = ['rewardToken']
