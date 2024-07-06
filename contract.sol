// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract ALPHA is ERC20, Ownable, ReentrancyGuard {
    event Claim(address indexed account, uint256 amount);

    uint256 public immutable marketingAllocation;
    uint256 public immutable liquidityAllocation;
    uint256 public immutable communityAllocation;

    bytes32 private communityRoot;
    uint256 public communityClaimedAmount;

    mapping(address wallet => bool) public communityClaimed;

    // _SUPPLY:1000000000000000000000000000
    // _MARKETINGWALLET:0x4a054047D2fDFa1B76a7fF9f8D26AaC0B55D83Da
    // _LIQUIDITYWALLET:0xF8893984FDd06556F40E633ba4aE28dc5F2B3000

    constructor(
        uint256 _supply,
        address _marketingWallet,
        address _liquidityWallet
    ) ERC20("Alpha On Blast", "ALPHA") Ownable(msg.sender) {
        marketingAllocation = (_supply * 5) / 100;
        liquidityAllocation = (_supply * 30) / 100;
        communityAllocation = (_supply * 65) / 100;

        super._mint(_marketingWallet, marketingAllocation);
        super._mint(_liquidityWallet, liquidityAllocation);
        super._mint(address(this), communityAllocation);
    }

    function claim(bytes32[] memory _merkleProof, uint256 _claimAmount) external {
        require(!communityClaimed[msg.sender], "Already claimed");
        require(
            communityClaimedAmount + _claimAmount <= communityAllocation,
            "Community allocation has been totally claimed"
        );
        uint256 scaledAmount = _claimAmount * 10**18;
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _claimAmount));
        require(MerkleProof.verify(_merkleProof, communityRoot, leaf), "Invalid Merkle Proof");
        communityClaimed[msg.sender] = true;
        communityClaimedAmount += scaledAmount;
        require(this.transfer(msg.sender, scaledAmount), "Token transfer failed");
        emit Claim(msg.sender, scaledAmount);
    }

    function setCommunityRoot(bytes32 root) external onlyOwner {
        communityRoot = root;
    }
}