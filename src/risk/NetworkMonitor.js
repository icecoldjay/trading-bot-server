/**
 * NetworkMonitor Module
 * Monitors network conditions and gas prices
 */

const { ethers } = require("ethers");
const config = require("../../config");
const logger = require("../../utils/logger");

class NetworkMonitor {
  constructor() {
    this.currentGasPrice = config.bsc.gasPrice;
    this.updateInterval = null;
    this.callbacks = {
      onGasPriceUpdate: null,
      onNetworkCongestion: null,
    };
  }

  /**
   * Initialize the network monitor
   */
  async initialize() {
    try {
      logger.info("Initializing network monitor...");

      // Get initial gas price
      await this.updateGasPrice();

      // Start polling for gas price updates
      this.startMonitoring();

      logger.info("Network monitor initialized successfully");
      return true;
    } catch (error) {
      logger.error("Failed to initialize network monitor:", error.message);
      return false;
    }
  }

  /**
   * Start monitoring network conditions
   */
  startMonitoring() {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Set up a new interval
    this.updateInterval = setInterval(async () => {
      await this.updateGasPrice();
    }, 30000); // Check every 30 seconds

    logger.info("Network monitoring started");
  }

  /**
   * Update current gas price
   */
  async updateGasPrice() {
    try {
      const provider = new ethers.providers.JsonRpcProvider(config.bsc.rpcUrl);
      const gasPrice = await provider.getGasPrice();

      // Add a small buffer to the gas price
      const bufferedGasPrice = gasPrice.mul(110).div(100); // 10% buffer

      this.currentGasPrice = bufferedGasPrice.gt(config.bsc.gasPrice)
        ? bufferedGasPrice
        : config.bsc.gasPrice;

      logger.debug(
        `Updated gas price: ${ethers.utils.formatUnits(
          this.currentGasPrice,
          "gwei"
        )} gwei`
      );

      if (this.callbacks.onGasPriceUpdate) {
        this.callbacks.onGasPriceUpdate(this.currentGasPrice);
      }

      return this.currentGasPrice;
    } catch (error) {
      logger.error("Error updating gas price:", error.message);
      throw error;
    }
  }

  /**
   * Get current recommended gas price
   * @returns {BigNumber} Recommended gas price
   */
  getGasPrice() {
    return this.currentGasPrice;
  }

  /**
   * Register a callback for gas price updates
   * @param {Function} callback Function to call when gas price updates
   */
  onGasPriceUpdate(callback) {
    this.callbacks.onGasPriceUpdate = callback;
  }

  /**
   * Register a callback for network congestion
   * @param {Function} callback Function to call when network is congested
   */
  onNetworkCongestion(callback) {
    this.callbacks.onNetworkCongestion = callback;
  }

  /**
   * Stop the network monitoring
   */
  shutdown() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      logger.info("Network monitoring stopped");
    }
  }
}

module.exports = new NetworkMonitor();
