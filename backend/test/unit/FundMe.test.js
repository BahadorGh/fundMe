const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", function () {
          let fundMe
          let mockV3Aggregator
          let deployer
          const sendValue = ethers.utils.parseEther("1")
          beforeEach(async () => {
              // const accounts = await ethers.getSigners()
              // deployer = accounts[0]
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              fundMe = await ethers.getContract("FundMe", deployer)
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
              mockERC20Token = await ethers.getContract(
                  "MockERC20Token",
                  deployer
              )
          })

          describe("constructor", function () {
              it("sets the aggregator addresses correctly", async () => {
                  const response = await fundMe.getPriceFeed()
                  assert.equal(response, mockV3Aggregator.address)
              })
              // testing right ownership
              it("Should set the right owner", async function () {
                  expect(await fundMe.getOwner()).to.equal(deployer);
              })
          })

          describe("fund", function () {
              // https://ethereum-waffle.readthedocs.io/en/latest/matchers.html
              // could also do assert.fail
            describe("Validation", function () {
              it("Fails if you don't send enough ETH", async () => {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  )
              })
              it("Don't fails if you send enough ETH", async () => {
                  await expect(fundMe.fund({value: sendValue})).not.to.be.revertedWith(
                      "You need to spend more ETH!"
                  )
              })
              it("increases contract balance if you send enough ETH", async () => {
                const contractStartingBalance = await fundMe.provider.getBalance(fundMe.address);
                await fundMe.fund({value : sendValue})
                const contractAfterFundingBalance = await fundMe.provider.getBalance(fundMe.address);

                  await expect(contractAfterFundingBalance).to.be.above(
                      contractStartingBalance
                  )
              })
            })
              // we could be even more precise here by making sure exactly $50 works
              // but this is good enough for now
            describe("funding operation", function () {
              it("Updates the amount funded data structure", async () => {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  assert.equal(response.toString(), sendValue.toString())
              })
              it("Adds funder to array of funders", async () => {
                  await fundMe.fund({ value: sendValue })
                  const response = await fundMe.getFunder(0)
                  assert.equal(response, deployer)
              })
              it("Increments contract balance when receiving Ether directly", async function () {
                    const startingFundMeBalance =
                        await fundMe.provider.getBalance(fundMe.address)
                    
                    const accounts = await ethers.getSigners();

                    await accounts[1].sendTransaction({
                        to: fundMe.address,
                        value: sendValue
                    })

                    const endingFundMeBalance = await fundMe.provider.getBalance(
                        fundMe.address
                    )

                    assert.equal(
                        endingFundMeBalance.sub(startingFundMeBalance).toString(), 
                        sendValue.toString(),
                        "Receiving not done correctly");
              })
            })
            describe("Events", function () {
               it("Should emit an event on fund raised", async function () {
                    await expect(fundMe.fund({value : sendValue}))
                    .to.emit(fundMe, "Funded")
                    .withArgs(deployer, sendValue);
                });
            });
          })
          describe("withdraw", function () {
              beforeEach(async () => {
                  await fundMe.fund({ value: sendValue })
              })
              describe("Validation", function () {
                it("don't allows another account to withdraw", async function () {
                    const accounts = await ethers.getSigners()
                    const fundMeConnectedContract = await fundMe.connect(
                        accounts[1]
                    )
                    await expect(
                        fundMeConnectedContract.withdraw()
                    ).to.be.revertedWith("FundMe__NotOwner")
                })
                it("only allows the owner to withdraw", async function () {
                    const accounts = await ethers.getSigners()
                    const fundMeConnectedContract = await fundMe.connect(
                        accounts[0]
                    )
                    await expect(
                        fundMeConnectedContract.withdraw()
                    ).not.to.be.revertedWith("FundMe__NotOwner")
                })
                it("only allows the owner to make cheaper withdraw", async function () {
                    const accounts = await ethers.getSigners()
                    const fundMeConnectedContract = await fundMe.connect(
                        accounts[1]
                    )
                    await expect(
                        fundMeConnectedContract.cheaperWithdraw()
                    ).to.be.revertedWith("FundMe__NotOwner")
                })
              })
              describe("Withdraw Operation", function () {
                it("withdraws ETH from a single funder", async () => {
                    // Arrange
                    const startingFundMeBalance =
                        await fundMe.provider.getBalance(fundMe.address)
                    const startingDeployerBalance =
                        await fundMe.provider.getBalance(deployer)

                    // Act
                    const transactionResponse = await fundMe.withdraw()
                    const transactionReceipt = await transactionResponse.wait()
                    const { gasUsed, effectiveGasPrice } = transactionReceipt
                    const gasCost = gasUsed.mul(effectiveGasPrice)

                    const endingFundMeBalance = await fundMe.provider.getBalance(
                        fundMe.address
                    )
                    const endingDeployerBalance =
                        await fundMe.provider.getBalance(deployer)

                    // Assert
                    // Maybe clean up to understand the testing
                    assert.equal(endingFundMeBalance, 0)
                    assert.equal(
                        startingFundMeBalance
                            .add(startingDeployerBalance)
                            .toString(),
                        endingDeployerBalance.add(gasCost).toString()
                    )
                })
                // this test is overloaded. Ideally we'd split it into multiple tests
                // but for simplicity we left it as one
                it("allows us to withdraw with multiple funders", async () => {
                    // Arrange
                    const accounts = await ethers.getSigners()
                    for (i = 1; i < 6; i++) {
                        const fundMeConnectedContract = await fundMe.connect(
                            accounts[i]
                        )
                        await fundMeConnectedContract.fund({ value: sendValue })
                    }
                    const startingFundMeBalance =
                        await fundMe.provider.getBalance(fundMe.address)
                    const startingDeployerBalance =
                        await fundMe.provider.getBalance(deployer)

                    // Act
                    const transactionResponse = await fundMe.cheaperWithdraw()
                    // Let's comapre gas costs :)
                    // const transactionResponse = await fundMe.withdraw()
                    const transactionReceipt = await transactionResponse.wait()
                    const { gasUsed, effectiveGasPrice } = transactionReceipt
                    const withdrawGasCost = gasUsed.mul(effectiveGasPrice)
                    console.log(`GasCost: ${withdrawGasCost}`)
                    console.log(`GasUsed: ${gasUsed}`)
                    console.log(`GasPrice: ${effectiveGasPrice}`)
                    const endingFundMeBalance = await fundMe.provider.getBalance(
                        fundMe.address
                    )
                    const endingDeployerBalance =
                        await fundMe.provider.getBalance(deployer)
                    // Assert
                    assert.equal(
                        startingFundMeBalance
                            .add(startingDeployerBalance)
                            .toString(),
                        endingDeployerBalance.add(withdrawGasCost).toString()
                    )
                    // Make a getter for storage variables
                    await expect(fundMe.getFunder(0)).to.be.reverted

                    for (i = 1; i < 6; i++) {
                        assert.equal(
                            await fundMe.getAddressToAmountFunded(
                                accounts[i].address
                            ),
                            0
                        )
                    }
                })
                it("should return the correct version", async function () {
                    const expectedVersion = 0;
                    const actualVersion = await fundMe.getVersion();

                    assert.equal(actualVersion, expectedVersion, "Incorrect version returend");
                })
                it("should handle an empty array of funders", async function () {
                    await fundMe.withdraw();
                    await expect(true).to.be.true;
                })
                it("Does not revert and keeps the balance at zero", async () => {
                    // Attempt to withdraw from an empty contract balance
                    await fundMe.withdraw();

                    // Verify that the contract balance remains zero
                    const contractBalance = await fundMe.provider.getBalance(fundMe.address);
                    assert.equal(contractBalance.toString(), "0");
                });
            })
            describe("Events", function () {
              it("Should emit an event on withdraw", async function () {
                const contractBalance = await fundMe.provider.getBalance(fundMe.address)
                const contractBalanceNumber = ethers.BigNumber.from(contractBalance)

                await expect(fundMe.withdraw())
                    .to.emit(fundMe, "WithdrawFund")
                    .withArgs(contractBalanceNumber);
              });
            });
          })
          describe("withdrawRewards", function () {
            beforeEach(async () => {
                // Fund the contract and calculate the reward
                await fundMe.fund({ value: sendValue });
                const accounts = await ethers.getSigners();
                const nonOwner = accounts[1];
                await fundMe.connect(nonOwner).fund({ value: sendValue});
            });
            describe("Reward withdraw operation", function () {
                it("should assign reward if enough ETH sent", async function () {
                  const accounts = await ethers.getSigners();
                  const nonOwner = accounts[1];
      
                  await expect(
                    fundMe.connect(nonOwner).fund({value: sendValue})
                  ).not.to.be.revertedWith("You need to spend more ETH!");
                  });
            })
            describe("Reward calculation", function () {
                it("should revert if msg.sender didn't have any funds", async function () {
                    const accounts = await ethers.getSigners();
                    const nonOwner2 = accounts[2];

                    await expect(
                        fundMe.connect(nonOwner2).withdrawReward()
                        ).to.be.revertedWith("You need to fund first!");
                })
                it("should calculate the correct reward", async function () {
                    const accounts = await ethers.getSigners();
                    const nonOwner = accounts[1];
                    const rewardAmount = await fundMe.connect(nonOwner).rewardCalculator(nonOwner.address);
                    // const formattedRewardAmount = ethers.utils.formatEther(rewardAmount);
                    const expectedRewardAmount = sendValue.mul(5).div(10000);

                    await expect((rewardAmount).toString()).to.equal((expectedRewardAmount).toString());
                })
                it("should not send any rewards if msg.sender withdrawed rewards before", async function () {
                    const accounts = await ethers.getSigners();
                    const nonOwner = accounts[1];
                    const rewardAmount = await fundMe.connect(nonOwner).rewardCalculator(nonOwner.address);
                    await mockERC20Token.connect(accounts[0]).transfer(fundMe.address, rewardAmount)
                    await fundMe.connect(nonOwner).withdrawReward();
                    const nonOwnerTokenBalanceFirstTime = await mockERC20Token.balanceOf(nonOwner.address)
                    // await fundMe.connect(nonOwner).withdrawReward();
                    // const nonOwnerRewardTokenBalance = await mockERC20Token.balanceOf(nonOwner.address)

                    await expect((fundMe.connect(nonOwner).withdrawReward())).to.be.revertedWith("You already withdrawed your rewards!");
                })
                it("Should withdraw reward amount for the msg.sender", async function () {
                  const accounts = await ethers.getSigners();
                  const nonOwner = accounts[1];
                  const rewardAmount = await fundMe.connect(nonOwner).rewardCalculator(nonOwner.address);
                  console.log("rewardAmount", ethers.utils.formatEther(rewardAmount));
                  const nonOwnerTokenBalanceBefore = await mockERC20Token.balanceOf(nonOwner.address)
                  console.log("nonOwnerTokenBalanceBefore:", ethers.utils.formatEther(nonOwnerTokenBalanceBefore))
                //   const tx = await mockERC20Token.connect(accounts[0]).transfer(nonOwner.address, rewardAmount)
                  // console.log("Tx1:", tx);
                  await mockERC20Token.connect(accounts[0]).transfer(fundMe.address, rewardAmount)
                  // console.log("Tx2:", tx2);
                  const tx3 = await fundMe.connect(nonOwner).withdrawReward();
                  const nonOwnerTokenBalanceAfter = await mockERC20Token.balanceOf(nonOwner.address)
                  console.log("nonOwnerTokenBalanceAfter:", ethers.utils.formatEther(nonOwnerTokenBalanceAfter))

                  await expect(rewardAmount).to.equal(nonOwnerTokenBalanceAfter);

                //#region 
                /* commented codes
                const ownerTokenBalanceBefore = await mockERC20Token.balanceOf(accounts[0].address)
                const nonOwnerTokenBalanceBefore = await mockERC20Token.balanceOf(nonOwner.address)
                const fundMeTokenBalanceBefore = await mockERC20Token.balanceOf(nonOwner.address)
                const fundMeTokenBalanceAfter = await mockERC20Token.balanceOf(nonOwner.address)
                const ownerTokenBalanceAfter = await mockERC20Token.balanceOf(accounts[0].address)
                const nonOwnerTokenBalanceAfter = await mockERC20Token.balanceOf(nonOwner.address)
                console.log("ownerTokenBalance-before:", ethers.utils.formatEther(ownerTokenBalanceBefore));
                console.log("nonOwnerTokenBalance-before:", ethers.utils.formatEther(nonOwnerTokenBalanceBefore));
                console.log("fundMeTokenBalance-before:", ethers.utils.formatEther(fundMeTokenBalanceBefore));
                console.log("ownerTokenBalance-after:", ethers.utils.formatEther(ownerTokenBalanceAfter));
                console.log("nonOwnerTokenBalance-after:", ethers.utils.formatEther(nonOwnerTokenBalanceAfter));
                console.log("fundMeTokenBalance-after:", ethers.utils.formatEther(fundMeTokenBalanceAfter));
                */
                //#endregion
                  });
            })
        });
      })
