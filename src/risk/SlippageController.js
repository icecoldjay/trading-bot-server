/**
 * SlippageController Module
 * Manages and applies slippage tolerance to trades
 */

const { ethers } = require("ethers");
const config = require("../../config");
const logger = require("../../utils/logger");

class SlippageController {
  constructor() {
    this.callbacks = {
      onSlippageApplied: null,
    };
  }

  /**
   * Initialize the slippage controller
   */
  initialize() {
    logger.info("Initializing slippage controller...");
    return true;
  }

  /**
   * Apply slippage tolerance to an amount
   * @param {BigNumber} amount Original amount
   * @param {string} tradeType 'buy' or 'sell'
   * @returns {BigNumber} Amount with slippage applied
   */
  applySlippage(amount, tradeType) {
    const slippageTolerance = 1 - config.trading.maxSlippage;
    const adjustedAmount = amount
      .mul(ethers.BigNumber.from(Math.floor(slippageTolerance * 10000)))
      .div(10000);

    logger.debug(
      `Applied ${(config.trading.maxSlippage * 100).toFixed(
        2
      )}% slippage to ${tradeType} trade`
    );

    if (this.callbacks.onSlippageApplied) {
      this.callbacks.onSlippageApplied(tradeType, amount, adjustedAmount);
    }

    return adjustedAmount;
  }

  /**
   * Register a callback for slippage application
   * @param {Function} callback Function to call when slippage is applied
   */
  onSlippageApplied(callback) {
    this.callbacks.onSlippageApplied = callback;
  }
}

module.exports = new SlippageController();
