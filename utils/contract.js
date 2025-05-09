/**
 * Contracts Utility
 * Manages contract instances and wallet connections
 */

const { ethers } = require("ethers");
const config = require("../config");

// Create provider and wallet
const provider = new ethers.JsonRpcProvider(config.bsc.rpcUrl);
const wallet = new ethers.Wallet(config.wallet.privateKey, provider);

// Contract ABIs
const routerABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
];

const tokenABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

// Create contract instances
const pancakeRouter = new ethers.Contract(
  config.dex.routerAddress,
  routerABI,
  wallet
);

const wbtcToken = new ethers.Contract(config.tokens.WBTC, tokenABI, wallet);

const busdToken = new ethers.Contract(config.tokens.BUSD, tokenABI, wallet);

module.exports = {
  provider,
  wallet,
  pancakeRouter,
  wbtcToken,
  busdToken,
};
