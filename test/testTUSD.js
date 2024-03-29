const { expect } = require("chai")
const { ethers, network, deployments } = require("hardhat")
const { mainnet: network_ } = require("../addresses")
require("dotenv").config()
const IERC20_ABI = require("../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json").abi
const IYearn_ABI = require("../artifacts/interfaces/IYearn.sol/IYearn.json").abi
const IYvault_ABI = require("../artifacts/interfaces/IYvault.sol/IYvault.json").abi

const { tokenAddress, yEarnAddress, yVaultAddress } = network_.TUSD
const treasuryWalletAddress = "0x59E83877bD248cBFe392dbB5A8a29959bcb48592"
const communityWalletAddress = "0xdd6c35aFF646B2fB7d8A8955Ccbe0994409348d0"

const decimals = (amount) => {
    return ethers.utils.parseUnits(amount.toString(), 18)
}

describe("YearnFarmerTUSDv2", () => {
    const setup = async () => {
        const [deployerSigner, clientSigner] = await ethers.getSigners()

        const tokenContract = new ethers.Contract(tokenAddress, IERC20_ABI, deployerSigner)
        const yEarnContract = new ethers.Contract(yEarnAddress, IYearn_ABI, deployerSigner)
        const yVaultContract = new ethers.Contract(yVaultAddress, IYvault_ABI, deployerSigner)

        const yfTUSDContract = await ethers.getContract("YearnFarmerTUSDv2")
        const dvmTUSDContract = await ethers.getContract("DAOVaultMediumTUSD")

        return { deployerSigner, clientSigner , tokenContract, yEarnContract, yVaultContract, yfTUSDContract, dvmTUSDContract }
    }

    beforeEach(async () => {
        await deployments.fixture(["hardhat"])
    })

    it("should deploy contract correctly", async () => {
        // Get sender address and deploy the contracts
        const { deployerSigner, yfTUSDContract, dvmTUSDContract } = await setup()
        // Check if execute set vault function again to be reverted
        await expect(yfTUSDContract.setVault(deployerSigner.address)).to.be.revertedWith("Vault set")
        // Check if contract owner is contract deployer in both contracts
        expect(await yfTUSDContract.owner()).to.equal(deployerSigner.address)
        expect(await dvmTUSDContract.owner()).to.equal(deployerSigner.address)
        // Check if token accept is TUSD in both contract
        expect(await yfTUSDContract.token()).to.equal(tokenAddress)
        expect(await dvmTUSDContract.token()).to.equal(tokenAddress)
        // Check if Yearn TUSD Earn contract and Yearn TUSD Vault contract match given contract in Yearn Farmer contract
        expect(await yfTUSDContract.earn()).to.equal(yEarnAddress)
        expect(await yfTUSDContract.vault()).to.equal(yVaultAddress)
        // Check if initial pool set correctly in Yearn Farmer contract
        expect(await yfTUSDContract.pool()).to.equal(0)
        // Check if treasury wallet address match given address in Yearn Farmer contract
        expect(await yfTUSDContract.treasuryWallet()).to.equal(treasuryWalletAddress)
        // Check if community wallet address match given address in Yearn Farmer contract
        expect(await yfTUSDContract.communityWallet()).to.equal(communityWalletAddress)
        // Check if initial tier2 of network fee is 50000e18+1 <= tokenAmount <= 100000e18 in Yearn Farmer contract (More details in contract)
        expect(await yfTUSDContract.networkFeeTier2(0)).to.equal(decimals(50000).add(1))
        expect(await yfTUSDContract.networkFeeTier2(1)).to.equal(decimals(100000))
        // Check if initial network fee percentage is 1% for tier1, 0.75% for tier2, and 0.5% for tier3 in Yearn Farmer contract (More details in contract)
        expect(await yfTUSDContract.networkFeePercentage(0)).to.equal(100) // 1% = 100/10000, more detail in contract
        expect(await yfTUSDContract.networkFeePercentage(1)).to.equal(75) // 1% = 50/10000, more detail in contract
        expect(await yfTUSDContract.networkFeePercentage(2)).to.equal(50) // 1% = 25/10000, more detail in contract
        // Check if initial custom network fee tier is 1000000e18
        expect(await yfTUSDContract.customNetworkFeeTier()).to.equal(decimals(1000000))
        // Check if initial custom network fee percentage is 0.25%
        expect(await yfTUSDContract.customNetworkFeePercentage()).to.equal(25)
        // Check if initial profile sharing fee percentage is 10% in Yearn Farmer contract
        expect(await yfTUSDContract.profileSharingFeePercentage()).to.equal(1000)
        // Check if contract is not vesting in Yearn Farmer contract
        expect(await yfTUSDContract.isVesting()).is.false
        // Check if daoVaultTUSD contract address set correctly in Yearn Farmer contract
        expect(await yfTUSDContract.daoVault()).to.equal(dvmTUSDContract.address)
        // Check daoTUSD token is set properly in daoVaultTUSD contract
        expect(await dvmTUSDContract.name()).to.equal("DAO Vault Medium TUSD")
        expect(await dvmTUSDContract.symbol()).to.equal("dvmTUSD")
        expect(await dvmTUSDContract.decimals()).to.equal(18)
        // Check if strategy match given contract in daoVaultTUSD contract
        expect(await dvmTUSDContract.strategy()).to.equal(yfTUSDContract.address)
        // Check pendingStrategy is no pre-set in daoVaultTUSD contract
        expect(await dvmTUSDContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
        expect(await dvmTUSDContract.canSetPendingStrategy()).is.true
        // Check if no unlockTime set yet in daoVaultTUSD contract
        expect(await dvmTUSDContract.unlockTime()).to.equal(0)
        // Check if timelock duration is 2 days in daoVaultTUSD contract
        expect(await dvmTUSDContract.LOCKTIME()).to.equal(2*24*60*60) // 2 days in seconds
    })

    // Check user functions
    describe("User functions", () => {
        it("should able to deposit earn and vault correctly", async () => {
            // Get sender address and deploy the contracts
            const { deployerSigner, clientSigner, tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Transfer some TUSD to client
            await tokenContract.transfer(clientSigner.address, decimals(1000))
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(decimals(1000))
            // Check if meet the function requirements
            const sampleContract_JSON = require("../build/SampleContract.json")
            const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvmTUSDContract.address, tokenContract.address])
            await tokenContract.transfer(sampleContract.address, decimals(1000))
            expect(await tokenContract.balanceOf(sampleContract.address)).to.equal(decimals(1000))
            await sampleContract.approve(yfTUSDContract.address)
            await expect(sampleContract.deposit()).to.be.revertedWith("Only EOA")
            await expect(dvmTUSDContract.connect(clientSigner).deposit([0, 0])).to.be.revertedWith("Amount must > 0")
            await expect(yfTUSDContract.connect(clientSigner).deposit([decimals(100), decimals(200)])).to.be.revertedWith("Only can call from Vault")
            // Deposit 100 TUSD to Yearn Earn contract and 200 to Yearn Vault Contract
            await tokenContract.connect(clientSigner).approve(yfTUSDContract.address, decimals(1000))
            await dvmTUSDContract.connect(clientSigner).deposit([decimals(100), decimals(200)])
            // Check if user deposit successfully with correct amount
            const earnDepositAmount = await yfTUSDContract.getEarnDepositBalance(clientSigner.address)
            const vaultDepositAmount = await yfTUSDContract.getVaultDepositBalance(clientSigner.address)
            // Network fee for amount < 10000 is 1% by default
            const earnDepositBalance = decimals(100).sub(decimals(100).mul(100).div(10000))
            const vaultDepositBalance = decimals(200).sub(decimals(200).mul(100).div(10000))
            expect(earnDepositAmount).to.equal(earnDepositBalance)
            expect(vaultDepositAmount).to.equal(vaultDepositBalance)
            expect(await dvmTUSDContract.balanceOf(clientSigner.address)).to.equal(earnDepositAmount.add(vaultDepositAmount))
        })

        it("should deduct correct fees from deposit amount based on tier", async () => {
            // Get signer and address of sender and deploy the contracts
            const { deployerSigner, tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Check deduct network fee correctly in tier 1
            await tokenContract.approve(yfTUSDContract.address, decimals(10000000))
            let earnDepositBalance, vaultDepositBalance
            await dvmTUSDContract.deposit([decimals(100), decimals(200)])
            // Network fee for amount < 10000 is 1% in tier 1 by default
            earnDepositBalance = decimals(100).sub(decimals(100).mul(100).div(10000))
            vaultDepositBalance = decimals(200).sub(decimals(200).mul(100).div(10000))
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(earnDepositBalance)
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(vaultDepositBalance)
            // Check deduct network fee correctly in tier 2
            await dvmTUSDContract.deposit([decimals(60000), decimals(20000)])
            // Network fee for amount > 50000 and amount <= 100000 is 0.75% in tier 2 by default
            earnDepositBalance = earnDepositBalance.add(decimals(60000).sub(decimals(60000).mul(75).div(10000)))
            vaultDepositBalance = vaultDepositBalance.add(decimals(20000).sub(decimals(20000).mul(75).div(10000)))
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(earnDepositBalance)
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(vaultDepositBalance)
            // Check deduct network fee correctly in tier 3
            await dvmTUSDContract.deposit([decimals(100000), decimals(200000)])
            // Network fee for amount > 100000 is 0.5% in tier 3 by default
            earnDepositBalance = earnDepositBalance.add(decimals(100000).sub(decimals(100000).mul(50).div(10000)))
            vaultDepositBalance = vaultDepositBalance.add(decimals(200000).sub(decimals(200000).mul(50).div(10000)))
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(earnDepositBalance)
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(vaultDepositBalance)
            // Check deduct network fee correctly in custom tier
            await dvmTUSDContract.deposit([decimals(1000000), decimals(2000000)])
            // Network fee for amount > 1000000 is 0.25% in custom tier by default
            earnDepositBalance = earnDepositBalance.add(decimals(1000000).sub(decimals(1000000).mul(25).div(10000)))
            vaultDepositBalance = vaultDepositBalance.add(decimals(2000000).sub(decimals(2000000).mul(25).div(10000)))
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(earnDepositBalance)
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(vaultDepositBalance)
        })

        it("should withdraw earn and vault correctly", async () => {
            // Get signer and address of sender and deploy the contracts
            const { clientSigner, tokenContract, yEarnContract, yVaultContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Transfer some TUSD to client
            await tokenContract.transfer(clientSigner.address, decimals(1000))
            // Deposit some TUSD into Yearn Farmer contract
            await tokenContract.connect(clientSigner).approve(yfTUSDContract.address, decimals(1000))
            const clientTokenAmountBeforeDeposit = await tokenContract.balanceOf(clientSigner.address)
            const earnDepositAmount = decimals(100)
            const vaultDepositAmount = decimals(200)
            await dvmTUSDContract.connect(clientSigner).deposit([earnDepositAmount, vaultDepositAmount])
            // Check if withdraw amount meet the function requirements
            await expect(dvmTUSDContract.connect(clientSigner).withdraw([decimals(1000), 0])).to.be.revertedWith("Insufficient balance")
            await expect(dvmTUSDContract.connect(clientSigner).withdraw([0, decimals(1000)])).to.be.revertedWith("Insufficient balance")
            await expect(yfTUSDContract.connect(clientSigner).withdraw([decimals(100), decimals(200)])).to.be.revertedWith("Only can call from Vault")
            // Get Yearn Farmer earn and vault deposit amount of client account 
            const earnDepositBalance = await yfTUSDContract.getEarnDepositBalance(clientSigner.address)
            const vaultDepositBalance = await yfTUSDContract.getVaultDepositBalance(clientSigner.address)
            // Get off-chain actual withdraw TUSD amount based on Yearn Earn and Vault contract
            const earnSharesInYearnContract = (earnDepositBalance.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            const actualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(earnSharesInYearnContract)).div(await yEarnContract.totalSupply())
            const vaultSharesinYearnContract = (vaultDepositBalance.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            const actualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(vaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            // Get shares based on deposit
            const daoEarnShares = earnDepositBalance.mul(await dvmTUSDContract.totalSupply()).div(await yfTUSDContract.pool())
            const daoVaultTUSDShares = vaultDepositBalance.mul(await dvmTUSDContract.totalSupply()).div(await yfTUSDContract.pool())
            // Withdraw all from Yearn Earn and Vault
            await dvmTUSDContract.connect(clientSigner).withdraw([daoEarnShares, daoVaultTUSDShares])
            // Check if balance deposit amount in Yearn Farmer contract is correct
            expect(await yfTUSDContract.getEarnDepositBalance(clientSigner.address)).to.equal(0)
            expect(await yfTUSDContract.getVaultDepositBalance(clientSigner.address)).to.equal(0)
            // Check if daoTUSD in client account is correct
            expect(await dvmTUSDContract.balanceOf(clientSigner.address)).to.equal(0)
            // Check if pool amount in contract is Yearn Farmer is correct
            expect(await yfTUSDContract.pool()).to.equal(0)
            // Check if TUSD amount withdraw from Yearn Farmer contract is correct
            const clientTokenAmountAfterWithdraw = clientTokenAmountBeforeDeposit.sub(earnDepositAmount.add(vaultDepositAmount)).add(actualEarnWithdrawAmount.add(actualVaultWithdrawAmount))
            expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(clientTokenAmountAfterWithdraw, 1)
        })

        // it("should withdraw earn and vault correctly if there is profit", async () => {
        //     // To run this test you must comment out r variable in withdrawEarn() and withdrawVault() function
        //     // and assign r with the amount higher than deposit amount
        //     // For example "uint256 r = 200e18" in withdrawEarn() and "uint256 r = 400e18" in withdrawVault
        //     // if deposit 100e18 for Yearn Earn contract and 200e18 for Yearn Vault contract
        //     // Besides, you must provide some TUSD to Yearn Farmer contract as profit from Yearn contract
        //     // Get signer and address of sender and deploy the contracts
        //     const { deployerSigner, tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
        //     // Get treasury wallet TUSD balance before deposit
        //     const treasuryWalletTokenBalBeforeDeposit = await tokenContract.balanceOf(treasuryWalletAddress)
        //     // Get community wallet TUSD balance before deposit
        //     const communityWalletTokenBalBeforeDeposit = await tokenContract.balanceOf(communityWalletAddress)
        //     // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
        //     await tokenContract.approve(yfTUSDContract.address, decimals(1000))
        //     await dvmTUSDContract.deposit([decimals(100), decimals(200)])
        //     // Transfer some TUSD to Yearn Farmer contract as profit from Yearn contract
        //     await tokenContract.transfer(yfTUSDContract.address, decimals(1000))
        //     // Record TUSD amount of sender before withdraw earn shares
        //     const senderTokenAmountBeforeWithdraw = await tokenContract.balanceOf(deployerSigner.address)
        //     // Get earn and vault deposit balance of sender 
        //     const earnDepositBalance = await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)
        //     const vaultDepositBalance = await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)
        //     // Calculate fees for earn and vault profit
        //     const earnExampleWithdrawAmount = decimals(200)
        //     const earnFee = (earnExampleWithdrawAmount.sub(earnDepositBalance)).mul(10).div(100) // .mul(10).div(100): 10% profile sharing fee 
        //     const vaultExampleWithdrawAmount = decimals(400)
        //     const vaultFee = (vaultExampleWithdrawAmount.sub(vaultDepositBalance)).mul(10).div(100) // .mul(10).div(100): 10% profile sharing fee 
        //     // Get shares based on deposit
        //     const daoEarnShares = earnDepositBalance.mul(await dvmTUSDContract.totalSupply()).div(await yfTUSDContract.pool())
        //     const daoVaultTUSDShares = vaultDepositBalance.mul(await dvmTUSDContract.totalSupply()).div(await yfTUSDContract.pool())
        //     // Withdraw all from Yearn Earn and Vault contract
        //     await dvmTUSDContract.withdraw([daoEarnShares, daoVaultTUSDShares])
        //     // Check if total token balance is correct after withdraw
        //     expect(await tokenContract.balanceOf(deployerSigner.address)).to.equal(
        //         senderTokenAmountBeforeWithdraw
        //         .add(earnExampleWithdrawAmount.sub(earnFee))
        //         .add(vaultExampleWithdrawAmount.sub(vaultFee))
        //     )
        //     // Check if all fees transfer to treasury and community wallet correctly
        //     const networkFees = ((decimals(100).add(decimals(200))).mul(100).div(10000)).mul(50).div(100) // 1% network fee for tier 1, 50% split between treasury and community wallet
        //     const profileSharingFees = (earnFee.add(vaultFee)).mul(50).div(100) // 50% split between treasury and community wallet
        //     expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(treasuryWalletTokenBalBeforeDeposit.add(profileSharingFees.add(networkFees)))
        //     expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(communityWalletTokenBalBeforeDeposit.add(profileSharingFees.add(networkFees)))
        // })

        it("should able to get earn and vault deposit amount correctly", async () => {
            // Get signer and address of sender and client and deploy the contracts
            const { deployerSigner, clientSigner, tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await tokenContract.approve(yfTUSDContract.address, decimals(1000))
            await dvmTUSDContract.deposit([decimals(100), decimals(200)])
            // Deposit another 300 to Yearn Earn contract and 400 to Yearn Vault contract
            await dvmTUSDContract.deposit([decimals(300), decimals(400)])
            // Check if balance deposit of Yearn Earn contract and Yearn Vault contract after network fee return correctly
            const totalEarnDepositAfterFee = (decimals(100).add(decimals(300))).sub((decimals(100).add(decimals(300))).mul(100).div(10000)) // 1% network fee for tier 1
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(totalEarnDepositAfterFee)
            const totalVaultDepositAfterFee = (decimals(200).add(decimals(400))).sub((decimals(200).add(decimals(400))).mul(100).div(10000)) // 1% network fee for tier 1
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(totalVaultDepositAfterFee)
            // Transfer some TUSD to client account
            await tokenContract.transfer(clientSigner.address, decimals(1000))
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(decimals(1000))
            // Deposit 150 to Yearn Earn contract and 250 to Yearn Vault contract from client
            await tokenContract.connect(clientSigner).approve(yfTUSDContract.address, decimals(1000))
            await dvmTUSDContract.connect(clientSigner).deposit([decimals(150), decimals(250)])
            // Check if balance deposit of Yearn Earn contract and Yearn Vault contract after network fee from another account return correctly
            expect(await yfTUSDContract.getEarnDepositBalance(clientSigner.address)).to.equal(decimals(150).sub(decimals(150).mul(100).div(10000))) // 1% network fee for tier 1
            expect(await yfTUSDContract.getVaultDepositBalance(clientSigner.address)).to.equal(decimals(250).sub(decimals(250).mul(100).div(10000))) // 1% network fee for tier 1
        })

        it("should able to deal with mix and match situation (deposit and withdraw several times by several parties)", async () => {
             // Get signer and address of sender and client and deploy the contracts
            const { deployerSigner, clientSigner, tokenContract, yEarnContract, yVaultContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Transfer some token to client account
            await tokenContract.transfer(clientSigner.address, decimals(10000))
            expect(await tokenContract.balanceOf(clientSigner.address)).to.equal(decimals(10000))
            // Get sender and client account token balance before deposit
            const senderTknBalBefDep = await tokenContract.balanceOf(deployerSigner.address)
            const clientTknBalBefDep = await tokenContract.balanceOf(clientSigner.address)
            // Mix and max deposit
            await tokenContract.approve(yfTUSDContract.address, decimals(10000))
            await tokenContract.connect(clientSigner).approve(yfTUSDContract.address, decimals(10000))
            await dvmTUSDContract.deposit([decimals(123), 0])
            await dvmTUSDContract.connect(clientSigner).deposit([0, decimals(212)])
            await dvmTUSDContract.deposit([0, decimals(166)])
            await dvmTUSDContract.connect(clientSigner).deposit([decimals(249), 0])
            await dvmTUSDContract.deposit([decimals(132), decimals(186)])
            await dvmTUSDContract.connect(clientSigner).deposit([decimals(234), decimals(269)])
            // Get Yearn Farmer earn and vault network fees of accounts
            const senderEarnDepFee = (decimals(123).mul(100).div(10000)).add((decimals(132).mul(100).div(10000)))
            const senderVaultDepFee = (decimals(166).mul(100).div(10000)).add((decimals(186).mul(100).div(10000)))
            const clientEarnDepFee = (decimals(249).mul(100).div(10000)).add((decimals(234).mul(100).div(10000)))
            const clientVaultDepFee = (decimals(212).mul(100).div(10000)).add((decimals(269).mul(100).div(10000)))
            // Check if deposit amount of accounts return correctly
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(decimals(123+132).sub(senderEarnDepFee))
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(decimals(166+186).sub(senderVaultDepFee))
            expect(await yfTUSDContract.getEarnDepositBalance(clientSigner.address)).to.equal(decimals(249+234).sub(clientEarnDepFee))
            expect(await yfTUSDContract.getVaultDepositBalance(clientSigner.address)).to.equal(decimals(212+269).sub(clientVaultDepFee))
            // Check if daoTUSD distribute to accounts correctly
            expect(await dvmTUSDContract.balanceOf(deployerSigner.address)).to.equal(decimals(123+132+166+186).sub(senderEarnDepFee).sub(senderVaultDepFee))
            expect(await dvmTUSDContract.balanceOf(clientSigner.address)).to.equal(decimals(212+249+234+269).sub(clientEarnDepFee).sub(clientVaultDepFee))
            // Get accounts token balance after deposit
            const senderTknBalAftDep = await tokenContract.balanceOf(deployerSigner.address)
            const clientTknBalAftDep = await tokenContract.balanceOf(clientSigner.address)
            // Check if token balance of accounts deduct correctly after deposit
            expect(senderTknBalAftDep).to.equal(senderTknBalBefDep.sub(decimals(123+132+166+186)))
            expect(clientTknBalAftDep).to.equal(clientTknBalBefDep.sub(decimals(212+249+234+269)))
            // Check if network fees send to treasury and community wallet correctly
            const totalFees = senderEarnDepFee.add(senderVaultDepFee).add(clientEarnDepFee).add(clientVaultDepFee)
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(totalFees.mul(1).div(2))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(totalFees.mul(1).div(2))
            // Get Yearn Farmer pool amount
            const yfPool = await yfTUSDContract.pool()
            // Check if Yearn Farmer pool amount sum up correctly
            expect(yfPool).to.equal(
                (await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).add(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address))
                .add(await yfTUSDContract.getEarnDepositBalance(clientSigner.address)).add(await yfTUSDContract.getVaultDepositBalance(clientSigner.address))
            )
            // Mix and max withdraw
            await dvmTUSDContract.withdraw([decimals(200), 0])
            await dvmTUSDContract.connect(clientSigner).withdraw([decimals(132), 0])
            await dvmTUSDContract.withdraw([0, decimals(240)])
            await dvmTUSDContract.connect(clientSigner).withdraw([0, decimals(188)])
            // Get earn and vault deposit balance of accounts
            const senderEarnDepBalAftWdr = await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)
            const senderVaultDepBalAftWdr = await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)
            const clientEarnDepBalAftWdr = await yfTUSDContract.getEarnDepositBalance(clientSigner.address)
            const clientVaultDepBalAftWdr = await yfTUSDContract.getVaultDepositBalance(clientSigner.address)
            // Check if deposit amount of accounts return correctly after withdraw 1st time
            expect(senderEarnDepBalAftWdr).to.equal(decimals(123+132).sub(senderEarnDepFee).sub(decimals(200)))
            expect(senderVaultDepBalAftWdr).to.equal(decimals(166+186).sub(senderVaultDepFee).sub(decimals(240)))
            expect(clientEarnDepBalAftWdr).to.equal(decimals(249+234).sub(clientEarnDepFee).sub(decimals(132)))
            expect(clientVaultDepBalAftWdr).to.equal(decimals(212+269).sub(clientVaultDepFee).sub(decimals(188)))
            // Check if daoTUSD burn correctly in accounts
            expect(await dvmTUSDContract.balanceOf(deployerSigner.address)).to.equal(decimals(123+132+166+186).sub(decimals(123).mul(100).div(10000)).sub(decimals(132).mul(100).div(10000)).sub(decimals(166).mul(100).div(10000)).sub(decimals(186).mul(100).div(10000)).sub(decimals(200+240)))
            expect(await dvmTUSDContract.balanceOf(clientSigner.address)).to.equal(decimals(212+249+234+269).sub(decimals(212).mul(100).div(10000)).sub(decimals(249).mul(100).div(10000)).sub(decimals(234).mul(100).div(10000)).sub(decimals(269).mul(100).div(10000)).sub(decimals(132+188)))
            // Get accounts token balance after withdraw 1st time
            const senderTknBalAftWdr = await tokenContract.balanceOf(deployerSigner.address)
            const clientTknBalAftWdr = await tokenContract.balanceOf(clientSigner.address)
            // Get total withdraw amount of sender and client in big number
            const senderEarnWdrAmt = decimals(200)
            const senderVaultWdrAmt = decimals(240)
            const clientEarnWdrAmt = decimals(132)
            const clientVaultWdrAmt = decimals(188)
            // Get off-chain actual withdraw TUSD amount based on Yearn Earn and Vault contract
            let senderEarnSharesinYearnContract = (senderEarnWdrAmt.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            let senderActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(senderEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            let senderVaultSharesinYearnContract = (senderVaultWdrAmt.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            let senderActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(senderVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            let clientEarnSharesinYearnContract = (clientEarnWdrAmt.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            let clientActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            let clientVaultSharesinYearnContract = (clientVaultWdrAmt.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            let clientActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            // Check if token balance of accounts top-up correctly after withdraw
            expect(senderTknBalAftWdr).to.be.closeTo(senderTknBalAftDep.add(senderActualEarnWithdrawAmount).add(senderActualVaultWithdrawAmount), 1)
            expect(clientTknBalAftWdr).to.be.closeTo(clientTknBalAftDep.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount), 1)
            // Check if Yearn Contract pool amount deduct correctly
            expect(await yfTUSDContract.pool()).to.equal(yfPool.sub(senderEarnWdrAmt.add(senderVaultWdrAmt).add(clientEarnWdrAmt).add(clientVaultWdrAmt)))
            expect(await yfTUSDContract.totalSupply()).to.equal(yfPool.sub(senderEarnWdrAmt.add(senderVaultWdrAmt).add(clientEarnWdrAmt).add(clientVaultWdrAmt)))
            expect(await dvmTUSDContract.totalSupply()).to.equal(yfPool.sub(senderEarnWdrAmt.add(senderVaultWdrAmt).add(clientEarnWdrAmt).add(clientVaultWdrAmt)))
            // Get shares based on deposit
            const senderDaoEarnShares = (await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).mul(await dvmTUSDContract.totalSupply()).div(await yfTUSDContract.pool())
            const senderDaoVaultTUSDShares = (await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).mul(await dvmTUSDContract.totalSupply()).div(await yfTUSDContract.pool())
            const clientDaoEarnShares = (await yfTUSDContract.getEarnDepositBalance(clientSigner.address)).mul(await dvmTUSDContract.totalSupply()).div(await yfTUSDContract.pool())
            const clientDaoVaultTUSDShares = (await yfTUSDContract.getVaultDepositBalance(clientSigner.address)).mul(await dvmTUSDContract.totalSupply()).div(await yfTUSDContract.pool())
            // Withdraw all balance for accounts in Yearn contract 
            await dvmTUSDContract.withdraw([senderDaoEarnShares, 0])
            await dvmTUSDContract.connect(clientSigner).withdraw([clientDaoEarnShares, 0])
            await dvmTUSDContract.withdraw([0, senderDaoVaultTUSDShares])
            await dvmTUSDContract.connect(clientSigner).withdraw([0, clientDaoVaultTUSDShares])
            // // Check if deposit amount of accounts return 0
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(0)
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(0)
            expect(await yfTUSDContract.getEarnDepositBalance(clientSigner.address)).to.equal(0)
            expect(await yfTUSDContract.getVaultDepositBalance(clientSigner.address)).to.equal(0)
            // Check if daoTUSD burn to empty in accounts
            expect(await dvmTUSDContract.balanceOf(deployerSigner.address)).to.equal(0)
            expect(await dvmTUSDContract.balanceOf(clientSigner.address)).to.equal(0)
            // Get off-chain actual withdraw TUSD amount based on Yearn Earn and Vault contract
            senderEarnSharesinYearnContract = (senderEarnDepBalAftWdr.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            senderActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(senderEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            senderVaultSharesinYearnContract = (senderVaultDepBalAftWdr.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            senderActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(senderVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            clientEarnSharesinYearnContract = (clientEarnDepBalAftWdr.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken())
            clientActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            clientVaultSharesinYearnContract = (clientVaultDepBalAftWdr.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance())
            clientActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            // Check if token balance of accounts top-up correctly after withdraw all
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.be.closeTo(senderTknBalAftWdr.add(senderActualEarnWithdrawAmount).add(senderActualVaultWithdrawAmount), 1)
            expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(clientTknBalAftWdr.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount), 1)
            // Check if Yearn Contract pool amount return 0
            expect(await yfTUSDContract.pool()).to.equal(0)
        })

        it("should able to deal with mix and match situation (deposit and withdraw several times in tier 2)", async () => {
            // Get signer and address of sender and deploy the contracts
            const { deployerSigner, tokenContract, yEarnContract, yVaultContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Approve Yearn Farmer to transfer token from sender
            await tokenContract.approve(yfTUSDContract.address, decimals(1000000))
            // Get current balance TUSD of sender account
            const tokenBalanceBeforeDeposit = await tokenContract.balanceOf(deployerSigner.address)
            // Mix and max deposit and withdraw
            const depositAmount1 = decimals(62345)
            const depositAmount2 = decimals(97822)
            const depositAmount3 = decimals(4444)
            const depositAmount4 = decimals(22222)
            await dvmTUSDContract.deposit([depositAmount1, depositAmount4])
            const withdrawAmount1 = decimals(8932)
            let senderSharesinYearnContract = (withdrawAmount1).mul(await yEarnContract.totalSupply()).div(await yEarnContract.calcPoolValueInToken())
            let senderActualWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(senderSharesinYearnContract)).div(await yEarnContract.totalSupply())
            await dvmTUSDContract.withdraw([withdrawAmount1, 0])
            await dvmTUSDContract.deposit([depositAmount2, 0])
            await dvmTUSDContract.deposit([depositAmount3, 0])
            let currentTokenBalance = tokenBalanceBeforeDeposit.sub(depositAmount1).sub(depositAmount4).add(senderActualWithdrawAmount).sub(depositAmount2).sub(depositAmount3)
            const withdrawAmount2 = decimals(7035)
            senderSharesinYearnContract = withdrawAmount2.mul(await yEarnContract.totalSupply()).div(await yEarnContract.calcPoolValueInToken())
            senderActualWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(senderSharesinYearnContract)).div(await yEarnContract.totalSupply())
            await dvmTUSDContract.withdraw([withdrawAmount2, 0])
            currentTokenBalance = currentTokenBalance.add(senderActualWithdrawAmount)
            const withdrawAmount3 = decimals(19965)
            senderSharesinYearnContract = withdrawAmount3.mul(await yVaultContract.totalSupply()).div(await yVaultContract.balance())
            senderActualWithdrawAmount = ((await yVaultContract.balance()).mul(senderSharesinYearnContract)).div(await yVaultContract.totalSupply())
            await dvmTUSDContract.withdraw([0, withdrawAmount3])
            const depositAmount5 = decimals(59367)
            await dvmTUSDContract.deposit([0, depositAmount5])
            currentTokenBalance = currentTokenBalance.add(senderActualWithdrawAmount).sub(depositAmount5)
            // Check if balance token of sender account correctly after mix and max deposit and withdraw
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.be.closeTo(currentTokenBalance, 1)
            // Check if earn and vault deposit balance return correctly
            const earnDepositBalance = (depositAmount1.sub(depositAmount1.mul(75).div(10000))).add(depositAmount2.sub(depositAmount2.mul(75).div(10000))).add(depositAmount3.sub(depositAmount3.mul(100).div(10000))).sub(withdrawAmount1).sub(withdrawAmount2)
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(earnDepositBalance)
            const vaultDepositBalance = (depositAmount4.sub(depositAmount4.mul(75).div(10000))).add(depositAmount5.sub(depositAmount5.mul(75).div(10000)).sub(withdrawAmount3))
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(vaultDepositBalance)
            // Check if daoTUSD balance of sender account correct
            expect(await dvmTUSDContract.balanceOf(deployerSigner.address)).to.equal(earnDepositBalance.add(vaultDepositBalance))
            // Check if treasury and community wallet receive fees amount correctly
            const totalFees = (depositAmount1.mul(75).div(10000)).add(depositAmount2.mul(75).div(10000)).add(depositAmount4.mul(75).div(10000)).add(depositAmount3.mul(100).div(10000)).add(depositAmount5.mul(75).div(10000))
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.equal(totalFees.mul(1).div(2))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.equal(totalFees.mul(1).div(2))
            // Check if Yearn Farmer pool amount correct
            expect(await yfTUSDContract.pool()).to.equal((depositAmount1.sub(depositAmount1.mul(75).div(10000))).add(depositAmount2.sub(depositAmount2.mul(75).div(10000))).sub(withdrawAmount1).add(depositAmount4.sub(depositAmount4.mul(75).div(10000))).add(depositAmount3.sub(depositAmount3.mul(100).div(10000))).sub(withdrawAmount2).sub(withdrawAmount3).add(depositAmount5.sub(depositAmount5.mul(75).div(10000))))
        })

        it("should able to refund token when this contract is in vesting state", async () => {
            // Get address of owner and deploy the contracts
            const { clientSigner, tokenContract, yEarnContract, yVaultContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Transfer some token to client
            await tokenContract.transfer(clientSigner.address, decimals(1000))
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await tokenContract.connect(clientSigner).approve(yfTUSDContract.address, decimals(1000))
            await dvmTUSDContract.connect(clientSigner).deposit([decimals(100), decimals(200)])
            // Get client TUSD balance before refund
            const tokenBalanceBeforeRefund = await tokenContract.balanceOf(clientSigner.address)
            // Get client earn and vault deposit balance return before vesting
            const clientEarnDepositBalanceBeforeVesting = await yfTUSDContract.getEarnDepositBalance(clientSigner.address)
            const clientVaultDepositBalanceBeforeVesting = await yfTUSDContract.getVaultDepositBalance(clientSigner.address)
            // Get client off-chain actual earn withdraw amount
            const clientEarnSharesinYearnContract = (clientEarnDepositBalanceBeforeVesting).mul(await yEarnContract.totalSupply()).div(await yEarnContract.calcPoolValueInToken())
            const clientActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(clientEarnSharesinYearnContract)).div(await yEarnContract.totalSupply())
            const clientVaultSharesinYearnContract = (clientVaultDepositBalanceBeforeVesting).mul(await yVaultContract.totalSupply()).div(await yVaultContract.balance())
            const clientActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(clientVaultSharesinYearnContract)).div(await yVaultContract.totalSupply())
            // Execute vesting function
            await yfTUSDContract.vesting()
            // Check if function to get shares value return correctly
            expect(await yfTUSDContract.getSharesValue(clientSigner.address)).to.gte(clientActualEarnWithdrawAmount.add(clientActualVaultWithdrawAmount))
            // Check if refund function meet requirements
            await expect(dvmTUSDContract.refund()).to.be.revertedWith("No balance to refund")
            await expect(yfTUSDContract.refund(decimals(100))).to.be.revertedWith("Only can call from Vault")
            // Execute refund function
            await dvmTUSDContract.connect(clientSigner).refund()
            // Check if TUSD amount of client refund correctly
            expect(await tokenContract.balanceOf(clientSigner.address)).to.be.closeTo(tokenBalanceBeforeRefund.add(clientActualEarnWithdrawAmount).add(clientActualVaultWithdrawAmount), ethers.utils.parseEther("1"))
            // Check if daoTUSD of client burn to 0
            expect(await dvmTUSDContract.balanceOf(clientSigner.address)).to.equal(0)
        })

        it("should able to refund token with profit when this contract is in vesting state", async () => {
            // Get address of owner and deploy the contracts
            const { deployerSigner, tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Transfer some TUSD to Yearn Farmer contract as profit from Yearn contract
            await tokenContract.transfer(yfTUSDContract.address, decimals(1000))
            // Deposit 100 to Yearn Earn contract and 200 to Yearn Vault contract
            await tokenContract.approve(yfTUSDContract.address, decimals(1000))
            await dvmTUSDContract.deposit([decimals(100), decimals(200)])
            // Get client TUSD balance before refund
            const tokenBalanceBeforeRefund = await tokenContract.balanceOf(deployerSigner.address)
            // Execute vesting function
            await yfTUSDContract.vesting()
            // Get shares value before execute refund function
            const sharesValue = await yfTUSDContract.getSharesValue(deployerSigner.address)
            // Execute refund function
            await dvmTUSDContract.refund()
            // Check if refund token amount correctly
            expect(await tokenContract.balanceOf(deployerSigner.address)).to.equal(tokenBalanceBeforeRefund.add(sharesValue))
            // Check if Yearn-Farmer pool equal to 0
            expect(await yfTUSDContract.pool()).to.equal(0)
            expect(await dvmTUSDContract.balanceOf(deployerSigner.address)).to.equal(0)
            expect(await yfTUSDContract.balanceOf(dvmTUSDContract.address)).to.equal(0)
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(0)
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(0)
            expect(await yfTUSDContract.getSharesValue(deployerSigner.address)).to.equal(0)
        })

        it("should approve Yearn Earn and Vault contract to deposit TUSD from yfTUSD contract", async () => {
            // This function only execute one time and already execute while yfTUSD contract deployed.
            // User should ignore this function.

            // Get address of owner and deploy the contracts
            const { tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Check if Yearn Earn and Vault contract can deposit a huge amount of TUSD from yfTUSD contract
            await tokenContract.approve(yfTUSDContract.address, decimals(5000000))
            await expect(dvmTUSDContract.deposit([decimals(2500000), decimals(2500000)])).not.to.be.reverted
        })
    })


    // Test admin functions
    describe("Admin functions", () => {
        it("should able to transfer contract ownership to other address by contract owner only", async () => {
            // Get address of owner and new owner and deploy the contracts
            const { deployerSigner, clientSigner, yfTUSDContract, dvmTUSDContract } = await setup()
            // Check if contract ownership is owner before transfer
            expect(await yfTUSDContract.owner()).to.equal(deployerSigner.address)
            expect(await dvmTUSDContract.owner()).to.equal(deployerSigner.address)
            // Check if new owner cannot execute admin functions yet
            await expect(dvmTUSDContract.connect(clientSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmTUSDContract.connect(clientSigner).setPendingStrategy(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmTUSDContract.connect(clientSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setVault(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setTreasuryWallet(clientSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setNetworkFeeTier2([decimals(100), decimals(200)])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setCustomNetworkFeeTier(decimals(10000000))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setCustomNetworkFeePercentage(2000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
            // Transfer contract ownership from owner to new owner
            await dvmTUSDContract.transferOwnership(clientSigner.address)
            await yfTUSDContract.transferOwnership(clientSigner.address)
            // Check if contract ownership is new owner after transfer
            expect(await dvmTUSDContract.owner()).to.equal(clientSigner.address)
            expect(await yfTUSDContract.owner()).to.equal(clientSigner.address)
            // Check if new owner can execute admin function
            await expect(dvmTUSDContract.connect(clientSigner).unlockMigrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmTUSDContract.connect(clientSigner).setPendingStrategy(deployerSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmTUSDContract.connect(clientSigner).migrateFunds()).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setVault(deployerSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setTreasuryWallet(deployerSigner.address)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setNetworkFeeTier2([decimals(100), decimals(200)])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setNetworkFeePercentage([3000, 3000, 3000])).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setCustomNetworkFeeTier(decimals(10000000))).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).setCustomNetworkFeePercentage(2000)).not.to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(clientSigner).vesting()).not.to.be.revertedWith("Ownable: caller is not the owner")
            // Check if original owner neither can execute admin function nor transfer back ownership
            await expect(dvmTUSDContract.connect(deployerSigner).transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmTUSDContract.connect(deployerSigner).unlockMigrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmTUSDContract.connect(deployerSigner).setPendingStrategy(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(dvmTUSDContract.connect(deployerSigner).migrateFunds()).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(deployerSigner).transferOwnership(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(deployerSigner).setVault(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(deployerSigner).setTreasuryWallet(deployerSigner.address)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(deployerSigner).setNetworkFeeTier2([decimals(100), decimals(200)])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(deployerSigner).setNetworkFeePercentage([3900, 3900, 3900])).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(deployerSigner).setCustomNetworkFeeTier(decimals(20000000))).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(deployerSigner).setCustomNetworkFeePercentage(2000)).to.be.revertedWith("Ownable: caller is not the owner")
            await expect(yfTUSDContract.connect(deployerSigner).vesting()).to.be.revertedWith("Ownable: caller is not the owner")
        })

        it("should able to set pending strategy, migrate funds and set new strategy correctly in daoVaultTUSD contract", async () => {
            // Get address of deployer and deploy the contracts
            const { deployerSigner, tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Set pending strategy
            const sampleContract_JSON = require("../build/SampleContract.json")
            const sampleContract = await waffle.deployContract(deployerSigner, sampleContract_JSON, [dvmTUSDContract.address, tokenContract.address])
            await dvmTUSDContract.setPendingStrategy(sampleContract.address)
            // Check if pending strategy is set with given address
            expect(await dvmTUSDContract.pendingStrategy()).to.equal(sampleContract.address)
            // Deposit into daoVaultTUSD and execute vesting function
            await tokenContract.approve(yfTUSDContract.address, decimals(10000))
            await dvmTUSDContract.deposit([decimals(1000), decimals(2000)])
            await yfTUSDContract.vesting()
            // Get Yearn Farmer token balance before migrate
            const tokenBalance = await tokenContract.balanceOf(yfTUSDContract.address) 
            // Execute unlock migrate funds function
            await dvmTUSDContract.unlockMigrateFunds()
            // Check if execute migrate funds function before 2 days be reverted
            network.provider.send("evm_increaseTime", [86400]) // advance 1 day
            await expect(dvmTUSDContract.migrateFunds()).to.be.revertedWith("Function locked")
            network.provider.send("evm_increaseTime", [86400*2+60]) // advance another 2 days
            await expect(dvmTUSDContract.migrateFunds()).to.be.revertedWith("Function locked")
            // Execute unlock migrate funds function again
            await dvmTUSDContract.unlockMigrateFunds()
            network.provider.send("evm_increaseTime", [86400*2]) // advance for 2 days
            // Check if migrate funds function meet the requirements
            // await expect(dvmTUSDContract.migrateFunds()).to.be.revertedWith("No balance to migrate") // need to comment out deposit() function to test this
            // await expect(dvmTUSDContract.migrateFunds()).to.be.revertedWith("No pendingStrategy") // need to comment out set/check pending strategy function to test this
            // Approve for token transfer from Yearn Farmer to new strategy
            await yfTUSDContract.approveMigrate()
            // Check if migrate funds function is log
            await expect(dvmTUSDContract.migrateFunds()).to.emit(dvmTUSDContract, "MigrateFunds")
                .withArgs(yfTUSDContract.address, sampleContract.address, tokenBalance)
            // Check if token transfer correctly
            expect(await tokenContract.balanceOf(sampleContract.address)).to.equal(tokenBalance)
            expect(await tokenContract.balanceOf(yfTUSDContract.address)).to.equal(0)
            // Check if yfTUSD in daoVaultTUSD burn to 0
            expect(await yfTUSDContract.balanceOf(dvmTUSDContract.address)).to.equal(0)
            // Check if new strategy set and pending strategy reset to 0
            expect(await dvmTUSDContract.strategy()).to.equal(sampleContract.address)
            expect(await dvmTUSDContract.pendingStrategy()).to.equal(ethers.constants.AddressZero)
            // Check if execute migrate funds function again be reverted
            await expect(dvmTUSDContract.migrateFunds()).to.be.revertedWith("Function locked")
        })

        it("should able to set new treasury wallet correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and new treasury wallet and deploy the contracts
            const [_, newTreasuryWalletSigner] = await ethers.getSigners()
            const { tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Set new treasury wallet
            // Check if event for setTreasuryWallet function is logged
            await expect(yfTUSDContract.setTreasuryWallet(newTreasuryWalletSigner.address))
                .to.emit(yfTUSDContract, "SetTreasuryWallet")
                .withArgs(treasuryWalletAddress, newTreasuryWalletSigner.address)
            // Check if new treasury wallet is set to the contract
            expect(await yfTUSDContract.treasuryWallet()).to.equal(newTreasuryWalletSigner.address)
            // Check if new treasury wallet receive fees
            await tokenContract.approve(yfTUSDContract.address, decimals(1000))
            await dvmTUSDContract.deposit([decimals(100), decimals(200)])
            // 100 + 200 < 300 within network fee tier 1 hence fee = 1% split 50% between treasury and community wallet
            expect(await tokenContract.balanceOf(newTreasuryWalletSigner.address)).to.equal(decimals(100+200).mul(5).div(1000))
        })

        it("should able to set new community wallet correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and new community wallet and deploy the contracts
            const [_, newCommunityWalletSigner] = await ethers.getSigners()
            const { tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Set new community wallet
            // Check if event for setCommunityWallet function is logged
            await expect(yfTUSDContract.setCommunityWallet(newCommunityWalletSigner.address))
                .to.emit(yfTUSDContract, "SetCommunityWallet")
                .withArgs(communityWalletAddress, newCommunityWalletSigner.address)
            // Check if new community wallet is set to the contract
            expect(await yfTUSDContract.communityWallet()).to.equal(newCommunityWalletSigner.address)
            // Check if new treasury wallet receive fees
            await tokenContract.approve(yfTUSDContract.address, decimals(1000))
            await dvmTUSDContract.deposit([decimals(100), decimals(200)])
            // 100 + 200 < 300 within network fee tier 1 hence fee = 1% split 50% between treasury and community wallet
            expect(await tokenContract.balanceOf(newCommunityWalletSigner.address)).to.equal(decimals(100+200).mul(5).div(1000))
        })

        it("should able to set new network fee tier correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfTUSDContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(yfTUSDContract.setNetworkFeeTier2([0, decimals(10000)]))
                .to.be.revertedWith("Minimun amount cannot be 0")
            await expect(yfTUSDContract.setNetworkFeeTier2([decimals(10000), decimals(10000)]))
                .to.be.revertedWith("Maximun amount must greater than minimun amount")
            // Set network fee tier 2 with minimun 60001 and maximun 600000 (default 50001, 500000)
            // and Check if function is log
            await expect(yfTUSDContract.setNetworkFeeTier2([decimals(60000).add(1), decimals(600000)]))
                .to.emit(yfTUSDContract, "SetNetworkFeeTier2")
                .withArgs(["50000000000000000000001", "100000000000000000000000"], ["60000000000000000000001", "600000000000000000000000"]) // [oldNetworkFeeTier2, newNetworkFeeTier2]
            // Check if network fee tier 2 amount is set correctly
            expect(await yfTUSDContract.networkFeeTier2(0)).to.equal(decimals(60000).add(1))
            expect(await yfTUSDContract.networkFeeTier2(1)).to.equal(decimals(600000))
        })

        it("should able to set new custom network fee tier correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfTUSDContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(yfTUSDContract.setCustomNetworkFeeTier(decimals(1000)))
                .to.be.revertedWith("Custom network fee tier must greater than tier 2")
            // Set custom network fee tier to 2000000 (default 1000000)
            // and Check if function is log
            await expect(yfTUSDContract.setCustomNetworkFeeTier(decimals(2000000)))
                .to.emit(yfTUSDContract, "SetCustomNetworkFeeTier")
                .withArgs(ethers.utils.parseUnits("1", 24).toString(), ethers.utils.parseUnits("2", 24).toString()) // [oldCustomNetworkFeeTier, newCustomNetworkFeeTier]
            // Check if custom network fee tier amount is set correctly
            expect(await yfTUSDContract.customNetworkFeeTier()).to.equal(decimals(2000000))
        })

        it("should able to set new network fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfTUSDContract } = await setup()
            // Check if function parameter meet the requirements (100 = 1%)
            await expect(yfTUSDContract.setNetworkFeePercentage([4000, 0, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 40%")
            await expect(yfTUSDContract.setNetworkFeePercentage([0, 4000, 0]))
                .to.be.revertedWith("Network fee percentage cannot be more than 40%")
            await expect(yfTUSDContract.setNetworkFeePercentage([0, 0, 4000]))
                .to.be.revertedWith("Network fee percentage cannot be more than 40%")
            // Set network fee percentage to tier1 2%, tier2 1%, tier3 0.5% (default tier1 1%, tier2 0.5%, tier3 0.25%)
            // And check if function is log
            await expect(yfTUSDContract.setNetworkFeePercentage([200, 100, 50]))
                .to.emit(yfTUSDContract, "SetNetworkFeePercentage")
                .withArgs([100, 75, 50], [200, 100, 50]) // [oldNetworkFeePercentage, newNetworkFeePercentage]
            // Check if network fee percentage is set correctly
            expect(await yfTUSDContract.networkFeePercentage(0)).to.equal(200)
            expect(await yfTUSDContract.networkFeePercentage(1)).to.equal(100)
            expect(await yfTUSDContract.networkFeePercentage(2)).to.equal(50)
        })

        it("should able to set new custom network fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfTUSDContract } = await setup()
            // Check if function parameter meet the requirements (100 = 1%)
            await expect(yfTUSDContract.setCustomNetworkFeePercentage(60))
                .to.be.revertedWith("Custom network fee percentage cannot be more than tier 2")
            // Set network fee percentage to 0.1% (default 0.25%)
            // And check if function is log
            await expect(yfTUSDContract.setCustomNetworkFeePercentage(10))
                .to.emit(yfTUSDContract, "SetCustomNetworkFeePercentage")
                .withArgs(25, 10) // [oldCustomNetworkFeePercentage, newCustomNetworkFeePercentage]
            // Check if network fee percentage is set correctly
            expect(await yfTUSDContract.customNetworkFeePercentage()).to.equal(10)
        })

        it("should able to set new profile sharing fee percentage correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { yfTUSDContract } = await setup()
            // Check if function parameter meet the requirements
            await expect(yfTUSDContract.setProfileSharingFeePercentage(4000))
                .to.be.revertedWith("Profile sharing fee percentage cannot be more than 40%")
            // Set profile sharing fee percentage to 20% (default 10%) and check if function log
            await expect(yfTUSDContract.setProfileSharingFeePercentage(2000))
                .to.emit(yfTUSDContract, "SetProfileSharingFeePercentage")
                .withArgs(1000, 2000) // [oldProfileSharingFeePercentage, newProfileSharingFeePercentage]
            // Check if profile sharing fee percentage is set correctly
            expect(await yfTUSDContract.profileSharingFeePercentage()).to.equal(2000)
        })

        it("should set contract in vesting state correctly in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { deployerSigner, tokenContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Deposit into Yearn Farmer through daoVaultTUSD
            await tokenContract.approve(yfTUSDContract.address, decimals(1000))
            await dvmTUSDContract.deposit([decimals(100), decimals(200)])
            // Check if get shares value return 0 if no vesting (this function only available after vesting state)
            expect(await yfTUSDContract.getSharesValue(deployerSigner.address)).to.equal(0)
            // Check if corresponding function to be reverted if no vesting (these function only available after vesting state)
            await expect(dvmTUSDContract.refund()).to.be.revertedWith("Not in vesting state")
            await expect(yfTUSDContract.approveMigrate()).to.be.revertedWith("Not in vesting state")
            await yfTUSDContract.vesting()
            // Check if vesting state is true
            expect(await yfTUSDContract.isVesting()).is.true
            // Check if corresponding function to be reverted in vesting state
            await expect(dvmTUSDContract.deposit([decimals(100), decimals(200)])).to.be.revertedWith("Contract in vesting state")
            await expect(dvmTUSDContract.withdraw([decimals(50), decimals(100)])).to.be.revertedWith("Contract in vesting state")
            // Check if corresponding getter function return 0 in vesting state
            expect(await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)).to.equal(0) 
            expect(await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)).to.equal(0) 
            // Check if execute vesting function again to be reverted
            await expect(yfTUSDContract.vesting()).to.be.revertedWith("Already in vesting state")
            // Check if pool reset to 0 after vesting state
            expect(await yfTUSDContract.pool()).to.equal(0)
        })

        it("should send profit to treasury and community wallet correctly after vesting state in Yearn Farmer contract", async () => {
            // Get address of deployer and deploy the contracts
            const { deployerSigner, tokenContract, yEarnContract, yVaultContract, yfTUSDContract, dvmTUSDContract } = await setup()
            // Deposit into Yearn Farmer through daoVaultTUSD
            await tokenContract.approve(yfTUSDContract.address, decimals(1000))
            await dvmTUSDContract.deposit([decimals(100), decimals(200)])
            const treasuryWalletBalanceBeforeVesting = await tokenContract.balanceOf(treasuryWalletAddress)
            const communityWalletBalanceBeforeVesting = await tokenContract.balanceOf(communityWalletAddress)
            // Get off-chain Yearn earn and vault actual withdraw amount
            const earnDepositBalance = await yfTUSDContract.getEarnDepositBalance(deployerSigner.address)
            const vaultDepositBalance = await yfTUSDContract.getVaultDepositBalance(deployerSigner.address)
            const offChainActualEarnWithdrawAmount = ((await yEarnContract.calcPoolValueInToken()).mul(
                (earnDepositBalance.mul(await yEarnContract.totalSupply())).div(await yEarnContract.calcPoolValueInToken()))
            ).div(await yEarnContract.totalSupply())
            const offChainActualVaultWithdrawAmount = ((await yVaultContract.balance()).mul(
                (vaultDepositBalance.mul(await yVaultContract.totalSupply())).div(await yVaultContract.balance()))
            ).div(await yVaultContract.totalSupply())
            // Transfer some token to Yearn Farmer contract treat as profit
            await tokenContract.transfer(yfTUSDContract.address, decimals(100))
            await yfTUSDContract.vesting()
            // Check if balance token in Yearn Farmer contract correctly after fee
            expect(await tokenContract.balanceOf(yfTUSDContract.address)).to.equal(await yfTUSDContract.getSharesValue(deployerSigner.address))
            // Check if amount fee transfer to treasury and community wallet correctly (50% split)
            const profit = (await tokenContract.balanceOf(yfTUSDContract.address)).sub(offChainActualEarnWithdrawAmount.add(offChainActualVaultWithdrawAmount))
            const profileSharingFee = profit.mul(10).div(100)
            expect(await tokenContract.balanceOf(treasuryWalletAddress)).to.be.closeTo(treasuryWalletBalanceBeforeVesting.add(profileSharingFee.mul(50).div(100)), ethers.utils.parseEther("1"))
            expect(await tokenContract.balanceOf(communityWalletAddress)).to.be.closeTo(communityWalletBalanceBeforeVesting.add(profileSharingFee.mul(50).div(100)), ethers.utils.parseEther("1"))
        })
    })
})