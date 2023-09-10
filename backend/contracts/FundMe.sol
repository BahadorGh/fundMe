// SPDX-License-Identifier: MIT
// 1. Pragma
pragma solidity ^0.8.7;
// 2. Imports
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./PriceConverter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

// 3. Interfaces, Libraries, Contracts
error FundMe__NotOwner();

/**@title A sample Funding Contract
 * @author Patrick Collins
 * @notice This contract is for creating a sample funding contract
 * @dev This implements price feeds as our library
 */
contract FundMe {
    // Type Declarations
    using PriceConverter for uint256;
    using SafeMath for uint;

    // State variables
    uint256 public constant MINIMUM_USD = 50 * 10**18;
    address private immutable i_owner;
    IERC20 public rewardToken;
    address[] private s_funders;
    mapping(address => uint256) private s_addressToAmountFunded;
    AggregatorV3Interface private s_priceFeed;
    

    // Events (we have none!)
    event Funded(address indexed Funder, uint FundAmount);
    event WithdrawFund(uint WithdrawAmount);

    // Modifiers
    modifier onlyOwner() {
        // require(msg.sender == i_owner);
        if (msg.sender != i_owner) revert FundMe__NotOwner();
        _;
    }

    // Functions Order:
    //// constructor
    //// receive
    //// fallback
    //// external
    //// public
    //// internal
    //// private
    //// view / pure

    constructor(address priceFeed, IERC20 _rewardToken) {
        s_priceFeed = AggregatorV3Interface(priceFeed);
        i_owner = msg.sender;
        rewardToken = _rewardToken;
    }

    receive() external payable {
        fund();
    }

    /// @notice Funds our contract based on the ETH/USD price
    function fund() public payable {
        require(
            msg.value.getConversionRate(s_priceFeed) >= MINIMUM_USD,
            "You need to spend more ETH!"
        );
        // require(PriceConverter.getConversionRate(msg.value) >= MINIMUM_USD, "You need to spend more ETH!");
        s_addressToAmountFunded[msg.sender] += msg.value;
        s_funders.push(msg.sender);
        emit Funded(msg.sender, msg.value);
    }

    function withdraw() public onlyOwner {
        for (
            uint256 funderIndex = 0;
            funderIndex < s_funders.length;
            funderIndex++
        ) {
            address funder = s_funders[funderIndex];
            s_addressToAmountFunded[funder] = 0;
        }
        s_funders = new address[](0);
        uint balanceBeforeWithdrawal = address(this).balance;
        // Transfer vs call vs Send
        // payable(msg.sender).transfer(address(this).balance);
        // (bool success, ) = i_owner.call{value: address(this).balance}("");
        // require(success, "call failed");
        payable(i_owner).transfer(address(this).balance);
        emit WithdrawFund(balanceBeforeWithdrawal);
    }

    function cheaperWithdraw() public onlyOwner {
        address[] memory funders = s_funders;
        // mappings can't be in memory, sorry!
        for (
            uint256 funderIndex = 0;
            funderIndex < funders.length;
            ++funderIndex
        ) {
            address funder = funders[funderIndex];
            s_addressToAmountFunded[funder] = 0;
        }
        s_funders = new address[](0);
        uint balanceBeforeWithdrawal = address(this).balance;
        // payable(msg.sender).transfer(address(this).balance);
        payable(i_owner).transfer(address(this).balance);
        // (bool success, ) = i_owner.call{value: balanceBeforeWithdrawal}("");
        // require(success);
        emit WithdrawFund(balanceBeforeWithdrawal);
    }

    function withdrawReward() public {
        require(s_addressToAmountFunded[msg.sender] > 1, "You need to fund first!");
        IERC20(rewardToken).transfer(msg.sender, rewardCalculator(msg.sender));
    }
    function rewardCalculator(address _funder) public view returns (uint) {
        require(IERC20(rewardToken).balanceOf(_funder) == 0, "You already withdrawed your rewards!");
        return s_addressToAmountFunded[_funder].mul(5).div(10000);
    }

    /** @notice Gets the amount that an address has funded
     *  @param fundingAddress the address of the funder
     *  @return the amount funded
     */
    function getAddressToAmountFunded(address fundingAddress)
        public
        view
        returns (uint256)
    {
        return s_addressToAmountFunded[fundingAddress];
    }

    function getVersion() public view returns (uint256) {
        return s_priceFeed.version();
    }

    function getFunder(uint256 index) public view returns (address) {
        return s_funders[index];
    }

    function getOwner() public view returns (address) {
        return i_owner;
    }

    function getPriceFeed() public view returns (AggregatorV3Interface) {
        return s_priceFeed;
    }
}
