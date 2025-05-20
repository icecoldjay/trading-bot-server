/**
 * Application Entry Point
 * Initializes and coordinates all modules
 */

const logger = require("../utils/logger");
const BinanceService = require("./monitoring/BinanceService");
const DexPriceMonitor = require("./monitoring/DexPriceMonitor");
const IndicatorCalculator = require("./monitoring/IndicatorCalculator");
const SignalDetector = require("./trading/SignalDetector");
const TradeExecutor = require("./trading/TradeExecutor");
const PositionManager = require("./trading/PositionManager");
const NetworkMonitor = require("./risk/NetworkMonitor");
const StopLossManager = require("./risk/StopLossManager");

class WBTCScalpingBot {
  constructor() {
    this.isRunning = false;
  }

  async initialize() {
    try {
      logger.info("Starting WBTC Scalping Bot initialization...");

      // Initialize monitoring services
      await BinanceService.initialize();
      await DexPriceMonitor.initialize();

      // Initialize trading components
      await TradeExecutor.initialize();
      PositionManager.initialize();
      SignalDetector.initialize();

      // Initialize risk management
      await NetworkMonitor.initialize();
      StopLossManager.initialize();

      // Set up indicator calculator with initial data
      IndicatorCalculator.initialize(BinanceService.getHistoricalPrices());

      // Register event handlers
      this.registerEventHandlers();

      // Start monitoring for stop-loss
      StopLossManager.startMonitoring();

      this.isRunning = true;
      logger.info("WBTC Scalping Bot initialized and running");
    } catch (error) {
      logger.error("Failed to initialize bot:", error.message);
      process.exit(1);
    }
  }

  registerEventHandlers() {
    // Binance price updates
    BinanceService.onPriceUpdate((price, historicalPrices) => {
      // Update indicators with new price data
      IndicatorCalculator.updateIndicators(historicalPrices);

      // Check for trading signals
      SignalDetector.checkBuySignal(PositionManager.getCurrentPosition().type);
      SignalDetector.checkSellSignal(PositionManager.getCurrentPosition().type);
    });

    // Trading signals
    SignalDetector.onBuySignal(async (signal) => {
      logger.info("Processing buy signal...");
      const tradeResult = await TradeExecutor.executeBuy();
      if (tradeResult) {
        PositionManager.openPosition(DexPriceMonitor.getCurrentPrice());
      }
    });

    SignalDetector.onSellSignal(async (signal) => {
      logger.info("Processing sell signal...");
      const tradeResult = await TradeExecutor.executeSell();
      if (tradeResult) {
        PositionManager.closePosition(DexPriceMonitor.getCurrentPrice());
      }
    });

    // Position management
    PositionManager.onPositionOpened((position) => {
      logger.info(`New position opened: ${JSON.stringify(position)}`);
    });

    PositionManager.onPositionClosed((position) => {
      logger.info(`Position closed: ${JSON.stringify(position)}`);
    });
  }

  shutdown() {
    if (this.isRunning) {
      logger.info("Shutting down WBTC Scalping Bot...");

      // Shutdown services
      BinanceService.shutdown();
      DexPriceMonitor.shutdown();
      NetworkMonitor.shutdown();
      StopLossManager.shutdown();

      this.isRunning = false;
      logger.info("WBTC Scalping Bot shutdown complete");
    }
  }
}

// Start the bot
const bot = new WBTCScalpingBot();
bot.initialize();

// Handle process termination
process.on("SIGINT", () => {
  bot.shutdown();
  process.exit();
});

process.on("SIGTERM", () => {
  bot.shutdown();
  process.exit();
});
