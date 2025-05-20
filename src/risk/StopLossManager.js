/**
 * StopLossManager Module
 * Manages stop-loss orders and trailing stop-loss
 */

const config = require("../../config");
const logger = require("../../utils/logger");
const PositionManager = require("../trading/PositionManager");
const DexPriceMonitor = require("../monitoring/DexPriceMonitor");
const TradeExecutor = require("../trading/TradeExecutor");

class StopLossManager {
  constructor() {
    this.monitoringInterval = null;
    this.callbacks = {
      onStopLossTriggered: null,
    };
  }

  /**
   * Initialize the stop-loss manager
   */
  initialize() {
    logger.info("Initializing stop-loss manager...");
    return true;
  }

  /**
   * Start monitoring for stop-loss triggers
   */
  startMonitoring() {
    // Clear any existing interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Set up a new interval
    this.monitoringInterval = setInterval(async () => {
      await this.checkStopLoss();
    }, 15000); // Check every 15 seconds

    logger.info("Stop-loss monitoring started");
  }

  /**
   * Check if stop-loss should trigger
   */
  async checkStopLoss() {
    try {
      const currentPosition = PositionManager.getCurrentPosition();

      if (!currentPosition.type) {
        return; // No active position
      }

      // Update highest price in position manager
      const currentPrice = DexPriceMonitor.getCurrentPrice();
      PositionManager.updateHighestPrice(currentPrice);

      // Check if stop-loss should trigger
      if (PositionManager.shouldTriggerStopLoss(currentPrice)) {
        logger.warn("Stop-loss condition met! Executing sell...");

        // Execute sell
        const result = await TradeExecutor.executeSell();

        if (this.callbacks.onStopLossTriggered) {
          this.callbacks.onStopLossTriggered({
            price: currentPrice,
            highestPrice: currentPosition.highestPrice,
            timestamp: new Date(),
          });
        }

        return result;
      }
    } catch (error) {
      logger.error("Error checking stop-loss:", error.message);
      throw error;
    }
  }

  /**
   * Register a callback for stop-loss triggers
   * @param {Function} callback Function to call when stop-loss triggers
   */
  onStopLossTriggered(callback) {
    this.callbacks.onStopLossTriggered = callback;
  }

  /**
   * Stop the stop-loss monitoring
   */
  shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      logger.info("Stop-loss monitoring stopped");
    }
  }
}

module.exports = new StopLossManager();
