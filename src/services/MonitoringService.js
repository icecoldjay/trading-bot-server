const TaapiService = require("../bot-service/monitoring/TaapiService");
const DexPriceMonitor = require("../bot-service/monitoring/DexPriceMonitor");
const logger = require("../../utils/logger");

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
    this.dataUpdateCallbacks = [];
  }

  async initialize() {
    try {
      logger.info("Initializing Monitoring Service...");

      await TaapiService.initialize();
      await DexPriceMonitor.initialize();

      this.setupDataFlow();
      this.isRunning = true;

      logger.info("Monitoring Service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize Monitoring Service:", error);
      throw error;
    }
  }

  setupDataFlow() {
    TaapiService.onDataUpdate((data) => {
      this.marketData.centralized = {
        price: data.price,
        indicators: {
          rsi: data.indicators.rsi,
          ema: data.indicators.ema,
        },
      };
      this.updatePriceDifference();
    });

    DexPriceMonitor.onPriceUpdate((price) => {
      this.marketData.dex.price = price;
      this.updatePriceDifference();
    });
  }

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
    this.notifyDataUpdate();
  }

  notifyDataUpdate() {
    this.dataUpdateCallbacks.forEach((callback) => callback(this.marketData));
  }

  getCurrentData() {
    return { ...this.marketData };
  }

  isPotentialBuyOpportunity() {
    const data = this.marketData;
    const priceDiffCheck = data.priceDifference > 0.006; // 0.6% threshold
    const rsiCheck = TaapiService.isRsiOversold();
    const emaCheck = TaapiService.isPriceBelowEma();
    return priceDiffCheck && (rsiCheck || emaCheck);
  }

  isPotentialSellOpportunity() {
    const data = this.marketData;
    const priceDiffCheck = data.priceDifference < -0.006; // -0.6% threshold
    const rsiCheck = TaapiService.isRsiOverbought();
    const emaCheck = TaapiService.isPriceAboveEma();
    return priceDiffCheck && (rsiCheck || emaCheck);
  }

  onDataUpdate(callback) {
    this.dataUpdateCallbacks.push(callback);
  }

  shutdown() {
    if (this.isRunning) {
      TaapiService.shutdown();
      DexPriceMonitor.shutdown();
      this.isRunning = false;
    }
  }
}

module.exports = new MonitoringService();
