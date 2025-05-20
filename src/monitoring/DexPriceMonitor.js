/**
 * DexPriceMonitor Module
 * Monitors prices on DEX (PancakeSwap) and calculates price differences
 */

const { ethers } = require("ethers");
const config = require("../../config");
const logger = require("../../utils/logger");
const contracts = require("../../utils/contract");

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
   * Start monitoring prices at regular intervals
   */
  startMonitoring() {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Set up a new interval
    this.updateInterval = setInterval(async () => {
      await this.updatePrice();
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

      const amounts = await contracts.pancakeRouter.getAmountsOut(
        amountIn,
        path
      );
      const wbtcPriceInBusd = ethers.formatUnits(amounts[1], 18); // BUSD has 18 decimals

      this.price = parseFloat(wbtcPriceInBusd);

      logger.debug(`DEX price updated: 1 WBTC = ${this.price.toFixed(2)} BUSD`);

      // Notify callback if registered
      if (this.callbacks.onPriceUpdate) {
        this.callbacks.onPriceUpdate(this.price);
      }

      return this.price;
    } catch (error) {
      logger.error("Error updating DEX price:", error.message);
      throw error;
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
