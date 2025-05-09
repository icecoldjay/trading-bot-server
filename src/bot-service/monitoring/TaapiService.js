/**
 * TaapiService Module
 * Handles fetching market data and technical indicators from TAAPI.io
 * Using direct axios calls instead of the TAAPI npm package due to authentication issues
 * Uses cron job to schedule updates every 2 minutes
 */

const axios = require("axios");
const config = require("../../../config");
const logger = require("../../../utils/logger");
const cron = require("node-cron"); // Add cron dependency

class TaapiService {
  constructor() {
    // Define the base URL for TAAPI.io API
    this.baseUrl = "https://api.taapi.io";
    this.currentData = {
      price: 0,
      indicators: {
        rsi: null,
        ema: null,
      },
      lastUpdated: null,
    };
    this.cronJob = null;
    this.callbacks = {
      onDataUpdate: null,
    };

    // Add credentials debugging
    if (!config.taapi || !config.taapi.apiKey) {
      logger.error("TAAPI API key is missing in configuration");
    } else {
      logger.info("TAAPI configuration loaded successfully");
    }
  }

  /**
   * Initialize the TAAPI service
   */
  async initialize() {
    logger.info("Initializing TAAPI.io service...");

    try {
      // Get initial data
      await this.fetchData();

      // Start cron job for updates
      this.startCronJob();

      logger.info("TAAPI.io service initialized successfully");
      return true;
    } catch (error) {
      logger.error("Failed to initialize TAAPI.io service:", error.message);
      logger.error(error.stack); // Log the full stack trace for more details
      throw error;
    }
  }

  /**
   * Start cron job for data updates at 2-minute intervals
   */
  startCronJob() {
    // Stop any existing cron job
    if (this.cronJob) {
      this.cronJob.stop();
    }

    // Schedule new cron job to run every 2 minutes
    // Cron format: "minute hour day-of-month month day-of-week"
    // "*/2 * * * *" means "every 2 minutes"
    this.cronJob = cron.schedule("*/2 * * * *", async () => {
      try {
        logger.info("Running scheduled TAAPI data fetch (2-minute interval)");
        await this.fetchData();
      } catch (error) {
        logger.error("Error in scheduled TAAPI.io data fetch:", error.message);
      }
    });

    logger.info("TAAPI.io cron job scheduled to run every 2 minutes");
  }

  /**
   * Fetch all data directly without rate limiting
   * Makes API calls to get price, RSI, and EMA
   */
  async fetchData() {
    try {
      logger.debug("Starting data fetch...");

      // Fetch all data in parallel
      const [priceData, rsiData, emaData] = await Promise.all([
        this.fetchPrice(),
        this.fetchRsi(),
        this.fetchEma(),
      ]);

      // Update the current data
      this.currentData.price = priceData;
      this.currentData.indicators.rsi = rsiData.value;
      this.currentData.indicators.ema = emaData.value;
      this.currentData.lastUpdated = new Date();

      logger.debug(
        `TAAPI data updated: Price: ${priceData.toFixed(
          2
        )}, RSI: ${rsiData.value.toFixed(2)}, EMA: ${emaData.value.toFixed(2)}`
      );

      // Notify callback if registered
      if (this.callbacks.onDataUpdate) {
        this.callbacks.onDataUpdate({ ...this.currentData });
      }

      return this.currentData;
    } catch (error) {
      logger.error("Error fetching data from TAAPI.io:", error.message);
      logger.error(error.stack);
      throw error;
    }
  }

  /**
   * Fetch RSI from TAAPI.io
   */
  async fetchRsi() {
    try {
      // Direct axios call to ensure proper authentication
      const response = await axios.get(`${this.baseUrl}/rsi`, {
        params: {
          secret: config.taapi.apiKey,
          exchange: config.taapi.exchange,
          symbol: config.taapi.symbol,
          interval: config.taapi.interval,
          period: config.indicators.rsi.period,
        },
      });

      return response.data;
    } catch (error) {
      logger.error("Error fetching RSI from TAAPI.io:", error.message);
      logger.error(error.stack);
      throw error;
    }
  }

  /**
   * Fetch EMA from TAAPI.io
   */
  async fetchEma() {
    try {
      // Direct axios call to ensure proper authentication
      const response = await axios.get(`${this.baseUrl}/ema`, {
        params: {
          secret: config.taapi.apiKey,
          exchange: config.taapi.exchange,
          symbol: config.taapi.symbol,
          interval: config.taapi.interval,
          period: config.indicators.ema.period,
        },
      });

      return response.data;
    } catch (error) {
      logger.error("Error fetching EMA from TAAPI.io:", error.message);
      logger.error(error.stack);
      throw error;
    }
  }

  /**
   * Fetch current price from TAAPI.io
   */
  async fetchPrice() {
    try {
      // Using direct axios call
      const response = await axios.get(`${this.baseUrl}/price`, {
        params: {
          secret: config.taapi.apiKey,
          exchange: config.taapi.exchange,
          symbol: config.taapi.symbol,
          interval: config.taapi.interval,
        },
      });

      return parseFloat(response.data.value);
    } catch (error) {
      logger.error("Error fetching price data from TAAPI.io:", error.message);
      logger.error(error.stack);

      // Additional error details for debugging
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response data:`, error.response.data);
      }

      throw error;
    }
  }

  /**
   * Get current price and indicator data
   */
  getCurrentData() {
    return { ...this.currentData };
  }

  /**
   * Register a callback for data updates
   * @param {Function} callback Function to call when data is updated
   */
  onDataUpdate(callback) {
    this.callbacks.onDataUpdate = callback;
  }

  /**
   * Check if RSI is in oversold territory
   * @returns {Boolean} True if RSI is oversold
   */
  isRsiOversold() {
    return (
      this.currentData.indicators.rsi !== null &&
      this.currentData.indicators.rsi < config.indicators.rsi.oversold
    );
  }

  /**
   * Check if RSI is in overbought territory
   * @returns {Boolean} True if RSI is overbought
   */
  isRsiOverbought() {
    return (
      this.currentData.indicators.rsi !== null &&
      this.currentData.indicators.rsi > config.indicators.rsi.overbought
    );
  }

  /**
   * Check if price is above EMA
   * @returns {Boolean} True if price is above EMA
   */
  isPriceAboveEma() {
    return (
      this.currentData.indicators.ema !== null &&
      this.currentData.price > this.currentData.indicators.ema
    );
  }

  /**
   * Check if price is below EMA
   * @returns {Boolean} True if price is below EMA
   */
  isPriceBelowEma() {
    return (
      this.currentData.indicators.ema !== null &&
      this.currentData.price < this.currentData.indicators.ema
    );
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info("TAAPI.io cron job stopped");
    }
  }
}

module.exports = new TaapiService();
