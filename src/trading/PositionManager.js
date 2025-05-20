/**
 * PositionManager Module
 * Tracks current trading positions and entry/exit points
 */

const config = require("../../config");
const logger = require("../../utils/logger");
const contracts = require("../../utils/contracts");

class PositionManager {
  constructor() {
    this.currentPosition = null; // null = no position, 'long' = holding WBTC
    this.entryPrice = null;
    this.highestPrice = null;
    this.callbacks = {
      onPositionOpened: null,
      onPositionClosed: null,
    };
  }

  /**
   * Initialize the position manager
   */
  initialize() {
    logger.info("Initializing position manager...");
    return true;
  }

  /**
   * Open a new long position
   * @param {number} entryPrice Price at which position was opened
   */
  openPosition(entryPrice) {
    this.currentPosition = "long";
    this.entryPrice = entryPrice;
    this.highestPrice = entryPrice;

    logger.info(`Opened long position at $${entryPrice.toFixed(2)}`);

    if (this.callbacks.onPositionOpened) {
      this.callbacks.onPositionOpened({
        type: "long",
        entryPrice,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Close current position
   * @param {number} exitPrice Price at which position was closed
   */
  closePosition(exitPrice) {
    if (!this.currentPosition) {
      logger.warn("No position to close");
      return;
    }

    const positionType = this.currentPosition;
    const entryPrice = this.entryPrice;
    const profitPercent = ((exitPrice - entryPrice) / entryPrice) * 100;

    logger.info(`Closed ${positionType} position at $${exitPrice.toFixed(2)}`);
    logger.info(`Trade completed with ${profitPercent.toFixed(2)}% profit`);

    if (this.callbacks.onPositionClosed) {
      this.callbacks.onPositionClosed({
        type: positionType,
        entryPrice,
        exitPrice,
        profitPercent,
        timestamp: new Date(),
      });
    }

    // Reset position tracking
    this.currentPosition = null;
    this.entryPrice = null;
    this.highestPrice = null;
  }

  /**
   * Update highest price for trailing stop loss
   * @param {number} currentPrice Current market price
   */
  updateHighestPrice(currentPrice) {
    if (this.currentPosition && currentPrice > this.highestPrice) {
      this.highestPrice = currentPrice;
      logger.debug(`Updated highest price: $${this.highestPrice.toFixed(2)}`);
    }
  }

  /**
   * Check if stop-loss should trigger
   * @param {number} currentPrice Current market price
   * @returns {boolean} True if stop-loss should trigger
   */
  shouldTriggerStopLoss(currentPrice) {
    if (!this.currentPosition || !this.highestPrice) {
      return false;
    }

    const stopLossPrice =
      this.highestPrice * (1 - config.trading.trailingStopLoss);
    return currentPrice < stopLossPrice;
  }

  /**
   * Get current position information
   * @returns {Object} Current position details
   */
  getCurrentPosition() {
    return {
      type: this.currentPosition,
      entryPrice: this.entryPrice,
      highestPrice: this.highestPrice,
      unrealizedProfit: this.currentPosition
        ? ((this.highestPrice - this.entryPrice) / this.entryPrice) * 100
        : 0,
    };
  }

  /**
   * Register a callback for position opening
   * @param {Function} callback Function to call when position is opened
   */
  onPositionOpened(callback) {
    this.callbacks.onPositionOpened = callback;
  }

  /**
   * Register a callback for position closing
   * @param {Function} callback Function to call when position is closed
   */
  onPositionClosed(callback) {
    this.callbacks.onPositionClosed = callback;
  }
}

module.exports = new PositionManager();
