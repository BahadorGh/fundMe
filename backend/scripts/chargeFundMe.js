const { ethers, getNamedAccounts } = require("hardhat")

async function main() {
  const { deployer } = await getNamedAccounts()
  const fundMe = await ethers.getContract("FundMe", deployer)
  const RewardToken = await ethers.getContract("RewardToken", deployer)
  console.log(`Got contract FundMe at ${fundMe.address}`)
  console.log(`Got contract RewardToken at ${RewardToken.address}`)
  console.log("Funding fundMe contract...")
  const transactionResponse = await RewardToken.transfer(
    fundMe.address,
    10000000000
  )
  await transactionResponse.wait()
  console.log("Funded!")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
