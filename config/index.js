/**
 * Central Configuration Module
 * Loads environment variables and defines configuration parameters
 */

require("dotenv").config();
const { ethers } = require("ethers");

// Export the configuration object
module.exports = {
  // BSC network configuration
  bsc: {
    rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
    chainId: 56,
    gasPrice: ethers.parseUnits("5", "gwei"),
    gasLimit: 300000,
  },

  // Wallet and contracts
  wallet: {
    privateKey: process.env.PRIVATE_KEY,
    maxCapitalPerTrade: 0.1, // 10% of wallet balance
  },

  // Token addresses on BSC
  tokens: {
    WBTC: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", // WBTC on BSC
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", // BUSD on BSC
    USDT: "0x55d398326f99059fF775485246999027B3197955", // USDT on BSC
  },

  // PancakeSwap router address
  dex: {
    routerAddress: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2
    swapFee: 0.0025, // 0.25% fee per swap
  },

  // Trading parameters
  trading: {
    minProfitThreshold: 0.006, // 0.6% min profit after fees
    trailingStopLoss: 0.005, // 0.5% trailing stop loss
    maxSlippage: 0.002, // 0.2% max slippage
    refreshInterval: 60000, // Check conditions every 60 seconds
  },

  // Technical indicators
  indicators: {
    rsi: {
      period: 14,
      oversold: 30,
      overbought: 70,
    },
    ema: {
      period: 20,
    },
  },

  // TAAPI.io Configuration
  taapi: {
    apiKey:
      process.env.TAAPI_API_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbHVlIjoiNjgxYWY0MTU4MDZmZjE2NTFlN2Q2ZGI2IiwiaWF0IjoxNzQ2NTk2OTgyLCJleHAiOjMzMjUxMDYwOTgyfQ.861wGr42r6L-4J1log8H_d28__15xyJCheaf1K0hgP4",
    exchange: "binance",
    symbol: "BTC/USDT",
    interval: "1m", // 1-minute interval
    refreshInterval: 60000, // Refresh data every 60 seconds
    endpoints: {
      rsi: "/rsi",
      ema: "/ema",
      price: "/price",
    },
  },

  // Binance API - kept for price reference
  binance: {
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    symbol: "BTCUSDT",
    candleInterval: "1m", // 1 minute candles
  },
};
