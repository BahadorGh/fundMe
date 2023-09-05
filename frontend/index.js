import { ethers, providers } from "./ethers-5.6.esm.min.js"
import { abi, contractAddress, tokenContractAddress, tokenAbi } from "./constants.js"
// import { abi } from "./src/constants/contractAbi.json"
// import { contractAddress } from "./src/constants/contract-address.json"

const connectButton = document.getElementById("connectButton")
const withdrawButton = document.getElementById("withdrawButton")
const withdrawRewardsButton = document.getElementById("withdrawRewardsButton")
const fundButton = document.getElementById("fundButton")
const balanceButton = document.getElementById("balanceButton")
const fundersTables = document.getElementById("fundersTable")
let connectedAccount;
connectButton.onclick = connect
withdrawButton.onclick = withdraw
withdrawRewardsButton.onclick = withdrawRewards
fundButton.onclick = fund
balanceButton.onclick = getBalance


async function connect() {
  if (typeof window.ethereum !== "undefined") {
    try {
      await ethereum.request({ method: "eth_requestAccounts" })
    } catch (error) {
      console.log(error)
    }
    connectButton.innerHTML = "Connected"
    const accounts = await ethereum.request({ method: "eth_accounts" })
    connectedAccount = accounts
    console.log(connectedAccount)
  } else {
    connectButton.innerHTML = "Please install MetaMask"
  }
}

async function withdraw() {
    console.log(`Withdrawing...`)
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = provider.getSigner()
      const contract = new ethers.Contract(contractAddress, abi, signer)
      try {
        const transactionResponse = await contract.withdraw()
        await listenForTransactionMine(transactionResponse, provider)
        // await transactionResponse.wait(1)
      } catch ({data}) {
        if(data.code == -32603)
          alert("Only owner can withdraw funds!")
          console.log("You account address :", await signer.getAddress())
      }
    } else {
      withdrawButton.innerHTML = "Please install MetaMask"
    }
}

async function withdrawRewards() {
    console.log(`Withdrawing rewards...`)
    if (typeof window.ethereum !== "undefined") {
      const provider = new ethers.providers.Web3Provider(window.ethereum)
      await provider.send('eth_requestAccounts', [])
      const signer = provider.getSigner()
      const contract = new ethers.Contract(contractAddress, abi, signer)
      try {
        const transactionResponse = await contract.withdrawReward()
        await listenForTransactionMine(transactionResponse, provider)
        console.log(getRewardTokenBalance(await signer.getAddress()))
        // await transactionResponse.wait(1)
      } catch ({error= 'You already withdrawed your rewards. Bye!!'}) {
          console.log("error occured:", error)
          alert(error)
      }
    } else {
      withdrawButton.innerHTML = "Please install MetaMask"
    }
}

async function fund() {
  const ethAmount = document.getElementById("ethAmount").value
  if(connectedAccount != null) {
      console.log(`Funding with ${ethAmount}...`)
      if (typeof window.ethereum !== "undefined") {
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        const signer = provider.getSigner()
        const contract = new ethers.Contract(contractAddress, abi, signer)
        try {
          const transactionResponse = await contract.fund({
            value: ethers.utils.parseEther(ethAmount),
          })
        await listenForTransactionMine(transactionResponse, provider)
        addFundersToList(await signer.getAddress(), ethAmount)
      } catch ({error= 'You need to spend more ETH!'}) {
        alert("You need to spend more ETH!")
      }
    } else {
      fundButton.innerHTML = "Please install MetaMask"
    }
  } else {
    alert("Please first connect your wallet");
  }
}

async function getRewardTokenBalance(userWalletAddress) {
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  const contract = new ethers.Contract(tokenContractAddress, tokenAbi, provider)
  const tokenBalance = await contract.balanceOf(userWalletAddress)
  const tokenName = await contract.name()
  console.log(`${userWalletAddress} balance of Reward Token: ${ethers.utils.formatEther(tokenBalance)} ${tokenName}`)
}

async function getBalance() {
  if (typeof window.ethereum !== "undefined") {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    try {
      const balance = await provider.getBalance(contractAddress)
      console.log(ethers.utils.formatEther(balance))
      alert(`Contract balance: ${ethers.utils.formatEther(balance)} ETH`)
    } catch (error) {
      console.log(error)
    }
  } else {
    balanceButton.innerHTML = "Please install MetaMask"
  }
}

function listenForTransactionMine(transactionResponse, provider) {
    console.log(`Mining ${transactionResponse.hash}`)
    return new Promise((resolve, reject) => {
      try {
        provider.once(transactionResponse.hash, (transactionReceipt) => {
          console.log(
            `Completed with ${transactionReceipt.confirmations} confirmations. `
            )
            resolve()
          })
        } catch (error) {
          reject(error)
        }
      })
}

function addFundersToList(funderWalletAddress, fundingAmount) {
  let number = 0;
  var row = document.createElement("TR");
  var t = document.createTextNode(funderWalletAddress);
  var walletAddressColumn = document.createElement(`TD`);
  var t = document.createTextNode(funderWalletAddress);
  var fundingAmountColumn = document.createElement(`TD`);
  var z = document.createTextNode(`${fundingAmount} ETH`);
  row.appendChild(walletAddressColumn)
  row.appendChild(fundingAmountColumn)
  walletAddressColumn.appendChild(t);
  fundingAmountColumn.appendChild(z);
  fundersTables.appendChild(row);
}