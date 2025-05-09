/**
 * DexPriceMonitor Module
 * Monitors prices on DEX (PancakeSwap) and calculates price differences
 */

const { ethers } = require("ethers");
const config = require("../../../config");
const logger = require("../../../utils/logger");
const contracts = require("../../../utils/contract");

class DexPriceMonitor {
  constructor() {
    this.price = 0;
    this.updateInterval = null;
    this.callbacks = {
      onPriceUpdate: null,
    };
  }

  /**
   * Initialize the DEX price monitor
   */
  async initialize() {
    try {
      logger.info("Initializing DEX price monitor...");

      // Validate token addresses
      this.validateTokenAddresses();

      // Check if Router contract is properly initialized
      if (!contracts.pancakeRouter || !contracts.pancakeRouter.getAmountsOut) {
        throw new Error("PancakeSwap Router contract not properly initialized");
      }

      // Get initial price
      await this.updatePrice();

      // Start polling for price updates
      this.startMonitoring();

      logger.info("DEX price monitor initialized successfully");
      return true;
    } catch (error) {
      logger.error("Failed to initialize DEX price monitor:", error.message);
      return false;
    }
  }

  /**
   * Validate token addresses
   */
  validateTokenAddresses() {
    // Check if token addresses are valid Ethereum addresses
    if (!ethers.isAddress(config.tokens.WBTC)) {
      throw new Error(`Invalid WBTC address: ${config.tokens.WBTC}`);
    }

    if (!ethers.isAddress(config.tokens.BUSD)) {
      throw new Error(`Invalid BUSD address: ${config.tokens.BUSD}`);
    }

    logger.debug(`Using WBTC address: ${config.tokens.WBTC}`);
    logger.debug(`Using BUSD address: ${config.tokens.BUSD}`);
  }

  /**
   * Start monitoring prices at regular intervals
   */
  startMonitoring() {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Set up a new interval
    this.updateInterval = setInterval(async () => {
      try {
        await this.updatePrice();
      } catch (error) {
        logger.error("Error in price update interval:", error.message);
      }
    }, 15000); // Check DEX price every 15 seconds

    logger.info("DEX price monitoring started");
  }

  /**
   * Update the current price from the DEX
   */
  async updatePrice() {
    try {
      // We're checking the price of 1 WBTC in BUSD
      const path = [config.tokens.WBTC, config.tokens.BUSD];
      const amountIn = ethers.parseUnits("1", 8); // WBTC has 8 decimals

      logger.debug(`Getting DEX price: ${amountIn} WBTC to BUSD`);

      const amounts = await contracts.pancakeRouter.getAmountsOut(
        amountIn,
        path
      );

      // Verify we got valid results
      if (!amounts || amounts.length < 2 || amounts[1] === undefined) {
        throw new Error("Invalid amounts returned from DEX");
      }

      const wbtcPriceInBusd = ethers.formatUnits(amounts[1], 18); // BUSD has 18 decimals
      this.price = parseFloat(wbtcPriceInBusd);

      // Check if price is suspiciously low
      if (this.price < 0.01) {
        logger.warn(
          `Suspiciously low price detected: ${this.price} BUSD. Check token addresses and liquidity.`
        );
      }

      logger.debug(`DEX price updated: 1 WBTC = ${this.price.toFixed(2)} BUSD`);

      // Notify callback if registered
      if (this.callbacks.onPriceUpdate) {
        this.callbacks.onPriceUpdate(this.price);
      }

      return this.price;
    } catch (error) {
      logger.error("Error updating DEX price:", error.message);

      // More detailed error handling
      if (error.code === "CALL_EXCEPTION") {
        logger.error(
          "Contract call failed. Check if the token pair exists on PancakeSwap and has liquidity."
        );
      } else if (error.code === "NETWORK_ERROR") {
        logger.error(
          "Network connection issue. Check your RPC provider connection."
        );
      }

      throw error;
    }
  }

  /**
   * Check if there's liquidity for the token pair
   */
  async checkPairLiquidity() {
    try {
      const factoryABI = [
        "function getPair(address tokenA, address tokenB) external view returns (address pair)",
      ];

      const factoryContract = new ethers.Contract(
        "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", // PancakeSwap V2 Factory
        factoryABI,
        contracts.pancakeRouter.runner
      );

      const pairAddress = await factoryContract.getPair(
        config.tokens.WBTC,
        config.tokens.BUSD
      );

      if (pairAddress === "0x0000000000000000000000000000000000000000") {
        logger.error("No liquidity pair exists for WBTC-BUSD");
        return false;
      }

      logger.info(`WBTC-BUSD pair exists at address: ${pairAddress}`);
      return true;
    } catch (error) {
      logger.error("Error checking pair liquidity:", error.message);
      return false;
    }
  }

  /**
   * Get the current DEX price
   * @returns {number} Current price
   */
  getCurrentPrice() {
    return this.price;
  }

  /**
   * Calculate price difference between Binance and DEX as percentage
   * @param {number} binancePrice Current price on Binance
   * @returns {number} Price difference as percentage
   */
  calculatePriceDifference(binancePrice) {
    if (this.price === 0 || binancePrice === 0) {
      return 0;
    }

    return (binancePrice - this.price) / this.price;
  }

  /**
   * Check if DEX price lags behind Binance enough for a buy opportunity
   * @param {number} binancePrice Current price on Binance
   * @returns {boolean} True if there's a potential buy opportunity
   */
  isPotentialBuyOpportunity(binancePrice) {
    const priceDiff = this.calculatePriceDifference(binancePrice);
    return priceDiff > config.trading.minProfitThreshold;
  }

  /**
   * Check if DEX price leads Binance enough for a sell opportunity
   * @param {number} binancePrice Current price on Binance
   * @returns {boolean} True if there's a potential sell opportunity
   */
  isPotentialSellOpportunity(binancePrice) {
    const priceDiff = this.calculatePriceDifference(binancePrice);
    return priceDiff < -config.trading.minProfitThreshold;
  }

  /**
   * Register a callback for price updates
   * @param {Function} callback Function to call on price update
   */
  onPriceUpdate(callback) {
    this.callbacks.onPriceUpdate = callback;
  }

  /**
   * Stop the price monitoring
   */
  shutdown() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      logger.info("DEX price monitoring stopped");
    }
  }
}

module.exports = new DexPriceMonitor();
