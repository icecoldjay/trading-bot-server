/**
 * Main Application Entry Point
 * Sets up monitoring and trading services
 */

const config = require("../../config");
const logger = require("../../utils/logger");
const MonitoringService = require("./MonitoringService");

/**
 * Start the monitoring service and logging data
 */
async function startApplication() {
  try {
    logger.info("Starting application...");

    // Initialize monitoring with TAAPI.io integration
    const initialData = await MonitoringService.initialize();
    logger.info("Initial monitoring data:", initialData);

    // Set up regular data logging
    setInterval(() => {
      const currentData = MonitoringService.getCurrentData();

      // Log current market data
      logger.info("Market Data Summary:", {
        centralizedPrice: `$${currentData.centralized.price.toFixed(2)}`,
        dexPrice: `$${currentData.dex.price.toFixed(2)}`,
        priceDifference: `${(currentData.priceDifference * 100).toFixed(2)}%`,
        rsi: currentData.centralized.indicators.rsi?.toFixed(2),
        ema: currentData.centralized.indicators.ema?.toFixed(2),
        buyOpportunity: MonitoringService.isPotentialBuyOpportunity()
          ? "YES"
          : "NO",
        sellOpportunity: MonitoringService.isPotentialSellOpportunity()
          ? "YES"
          : "NO",
      });
    }, config.trading.refreshInterval);

    logger.info("Application started successfully");
  } catch (error) {
    logger.error("Failed to start application:", error);
    process.exit(1);
  }
}

// Start the application
startApplication();

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down application...");
  MonitoringService.shutdown();
  process.exit();
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  MonitoringService.shutdown();
  process.exit(1);
});
