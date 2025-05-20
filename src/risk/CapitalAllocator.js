/**
 * CapitalAllocator Module
 * Manages capital allocation and position sizing
 */

const { ethers } = require("ethers");
const config = require("../../config");
const logger = require("../../utils/logger");
const contracts = require("../../utils/contracts");

class CapitalAllocator {
  constructor() {
    this.callbacks = {
      onCapitalAllocated: null,
    };
  }

  /**
   * Initialize the capital allocator
   */
  initialize() {
    logger.info("Initializing capital allocator...");
    return true;
  }

  /**
   * Get the amount to allocate for a trade
   * @param {string} tradeType 'buy' or 'sell'
   * @returns {BigNumber} Amount to trade (in token decimals)
   */
  async getTradeAmount(tradeType) {
    try {
      let balance, decimals;

      if (tradeType === "buy") {
        // For buys, we spend BUSD
        balance = await contracts.busdToken.balanceOf(contracts.wallet.address);
        decimals = 18;
      } else {
        // For sells, we spend WBTC
        balance = await contracts.wbtcToken.balanceOf(contracts.wallet.address);
        decimals = 8;
      }

      // Calculate trade amount based on max capital per trade
      const maxPercent = config.wallet.maxCapitalPerTrade * 100;
      const tradeAmount = balance
        .mul(ethers.BigNumber.from(maxPercent))
        .div(100);

      logger.debug(
        `Allocating ${ethers.utils.formatUnits(
          tradeAmount,
          decimals
        )} for ${tradeType} trade`
      );

      if (this.callbacks.onCapitalAllocated) {
        this.callbacks.onCapitalAllocated(tradeType, tradeAmount);
      }

      return tradeAmount;
    } catch (error) {
      logger.error("Error calculating trade amount:", error.message);
      throw error;
    }
  }

  /**
   * Register a callback for capital allocation
   * @param {Function} callback Function to call when capital is allocated
   */
  onCapitalAllocated(callback) {
    this.callbacks.onCapitalAllocated = callback;
  }
}

module.exports = new CapitalAllocator();
