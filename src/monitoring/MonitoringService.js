/**
 * Monitoring Service Index
 * Integrates TAAPI.io for market data and indicators along with DEX price monitoring
 */

const logger = require("../../utils/logger");
const config = require("../../config");
const TaapiService = require("./TaapiService");
const DexPriceMonitor = require("./DexPriceMonitor");

class MonitoringService {
  constructor() {
    this.isRunning = false;
    this.marketData = {
      centralized: {
        price: 0,
        indicators: {
          rsi: null,
          ema: null,
        },
      },
      dex: {
        price: 0,
      },
      priceDifference: 0,
      timestamp: null,
    };
  }

  /**
   * Initialize monitoring components
   */
  async initialize() {
    try {
      logger.info("Initializing Monitoring Service...");

      // Initialize TAAPI service for centralized exchange data and indicators
      await TaapiService.initialize();

      // Initialize DEX price monitor for decentralized exchange prices
      await DexPriceMonitor.initialize();

      // Set up data flow between components
      this.setupDataFlow();

      this.isRunning = true;
      logger.info("Monitoring Service initialized and running");

      // Return initial data snapshot
      return this.getCurrentData();
    } catch (error) {
      logger.error("Failed to initialize Monitoring Service:", error);
      throw error;
    }
  }

  /**
   * Set up data flow between monitoring components
   */
  setupDataFlow() {
    // TAAPI data updates flow
    TaapiService.onDataUpdate((data) => {
      this.marketData.centralized = {
        price: data.price,
        indicators: {
          rsi: data.indicators.rsi,
          ema: data.indicators.ema,
        },
      };

      // Update price difference whenever centralized data changes
      this.updatePriceDifference();

      logger.debug(
        `Centralized data updated: $${data.price.toFixed(
          2
        )} | RSI: ${data.indicators.rsi?.toFixed(
          2
        )} | EMA: ${data.indicators.ema?.toFixed(2)}`
      );
    });

    // DEX price updates flow
    DexPriceMonitor.onPriceUpdate((price) => {
      this.marketData.dex.price = price;

      // Update price difference whenever DEX price changes
      this.updatePriceDifference();

      logger.debug(`DEX price updated: $${price.toFixed(2)}`);
    });
  }

  /**
   * Update the price difference calculation
   */
  updatePriceDifference() {
    if (
      this.marketData.centralized.price === 0 ||
      this.marketData.dex.price === 0
    ) {
      this.marketData.priceDifference = 0;
    } else {
      this.marketData.priceDifference =
        (this.marketData.centralized.price - this.marketData.dex.price) /
        this.marketData.dex.price;
    }

    this.marketData.timestamp = new Date();
  }

  /**
   * Get current monitoring data snapshot
   */
  getCurrentData() {
    return { ...this.marketData };
  }

  /**
   * Check if it's a good time to buy on DEX based on indicators and price difference
   */
  isPotentialBuyOpportunity() {
    const data = this.marketData;

    // Check if price difference exceeds threshold (centralized > DEX)
    const priceDiffCheck =
      data.priceDifference > config.trading.minProfitThreshold;

    // Check if RSI indicates oversold condition
    const rsiCheck = TaapiService.isRsiOversold();

    // Check if price is below EMA (potential upward movement)
    const emaCheck = TaapiService.isPriceBelowEma();

    // For a buy opportunity, we want price difference AND (oversold OR below EMA)
    return priceDiffCheck && (rsiCheck || emaCheck);
  }

  /**
   * Check if it's a good time to sell on DEX based on indicators and price difference
   */
  isPotentialSellOpportunity() {
    const data = this.marketData;

    // Check if price difference is negative and exceeds threshold (DEX > centralized)
    const priceDiffCheck =
      data.priceDifference < -config.trading.minProfitThreshold;

    // Check if RSI indicates overbought condition
    const rsiCheck = TaapiService.isRsiOverbought();

    // Check if price is above EMA (potential downward movement)
    const emaCheck = TaapiService.isPriceAboveEma();

    // For a sell opportunity, we want price difference AND (overbought OR above EMA)
    return priceDiffCheck && (rsiCheck || emaCheck);
  }

  /**
   * Shutdown monitoring service
   */
  shutdown() {
    if (this.isRunning) {
      logger.info("Shutting down Monitoring Service...");
      TaapiService.shutdown();
      DexPriceMonitor.shutdown();
      this.isRunning = false;
      logger.info("Monitoring Service shutdown complete");
    }
  }
}

// Export a singleton instance
module.exports = new MonitoringService();
