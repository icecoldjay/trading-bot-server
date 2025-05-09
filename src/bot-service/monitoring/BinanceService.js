/**
 * BinanceService Module
 * Handles connection to Binance for real-time price data and historical data
 */

const WebSocket = require("ws");
const axios = require("axios");
const config = require("../../../config");
const logger = require("../../../utils/logger");

class BinanceService {
  constructor() {
    this.ws = null;
    this.historicalPrices = [];
    this.currentPrice = 0;
    this.callbacks = {
      onPriceUpdate: null,
      onHistoricalDataLoaded: null,
    };
  }

  /**
   * Initialize the Binance service
   */
  async initialize() {
    logger.info("Initializing Binance service...");

    try {
      // Load historical data first
      await this.loadHistoricalData();

      // Then connect to WebSocket for real-time updates
      this.connectWebSocket();

      logger.info("Binance service initialized successfully");
      return true;
    } catch (error) {
      logger.error("Failed to initialize Binance service:", error.message);
      return false;
    }
  }

  /**
   * Load historical price data from Binance REST API
   */
  async loadHistoricalData() {
    try {
      logger.info("Loading historical price data...");

      const response = await axios.get(
        `${config.binance.restEndpoint}/api/v3/klines`,
        {
          params: {
            symbol: config.binance.symbol,
            interval: config.binance.candleInterval,
            limit: 100, // Get enough data to calculate indicators
          },
        }
      );

      // Format the data
      this.historicalPrices = response.data.map((candle) =>
        parseFloat(candle[4])
      ); // Close price

      logger.info(
        `Loaded ${this.historicalPrices.length} historical price points`
      );

      // Notify callback if registered
      if (this.callbacks.onHistoricalDataLoaded) {
        this.callbacks.onHistoricalDataLoaded(this.historicalPrices);
      }

      return this.historicalPrices;
    } catch (error) {
      logger.error("Error loading historical data:", error.message);
      throw error;
    }
  }

  /**
   * Connect to Binance WebSocket for real-time price updates
   */
  connectWebSocket() {
    logger.info("Connecting to Binance WebSocket...");

    this.ws = new WebSocket(config.binance.wsEndpoint);

    this.ws.on("open", () => {
      logger.info("WebSocket connection opened");

      // Subscribe to kline (candlestick) data
      const subscriptionMsg = JSON.stringify({
        method: "SUBSCRIBE",
        params: [
          `${config.binance.symbol.toLowerCase()}@kline_${
            config.binance.candleInterval
          }`,
        ],
        id: 1,
      });

      this.ws.send(subscriptionMsg);
    });

    this.ws.on("message", (data) => {
      try {
        const message = JSON.parse(data);

        // Process kline data
        if (message.e === "kline") {
          const candle = message.k;
          const closePrice = parseFloat(candle.c);

          // Update the latest price
          this.currentPrice = closePrice;

          // Update historical prices array
          this.historicalPrices.push(closePrice);
          if (this.historicalPrices.length > 100) {
            this.historicalPrices.shift(); // Keep array size manageable
          }

          // Notify callback if registered
          if (this.callbacks.onPriceUpdate) {
            this.callbacks.onPriceUpdate(closePrice, this.historicalPrices);
          }
        }
      } catch (error) {
        logger.error("Error processing WebSocket message:", error.message);
      }
    });

    this.ws.on("error", (error) => {
      logger.error("WebSocket error:", error.message);

      // Try to reconnect after a delay
      setTimeout(() => this.connectWebSocket(), 5000);
    });

    this.ws.on("close", () => {
      logger.warn("WebSocket connection closed. Reconnecting...");

      // Try to reconnect after a delay
      setTimeout(() => this.connectWebSocket(), 5000);
    });
  }

  /**
   * Register a callback for price updates
   * @param {Function} callback Function to call on price update
   */
  onPriceUpdate(callback) {
    this.callbacks.onPriceUpdate = callback;
  }

  /**
   * Register a callback for when historical data is loaded
   * @param {Function} callback Function to call when historical data is loaded
   */
  onHistoricalDataLoaded(callback) {
    this.callbacks.onHistoricalDataLoaded = callback;
  }

  /**
   * Get the current price
   * @returns {number} Current price
   */
  getCurrentPrice() {
    return this.currentPrice;
  }

  /**
   * Get historical prices
   * @returns {Array} Array of historical prices
   */
  getHistoricalPrices() {
    return this.historicalPrices;
  }

  /**
   * Close the connection
   */
  shutdown() {
    if (this.ws) {
      this.ws.close();
      logger.info("Binance WebSocket connection closed");
    }
  }
}

module.exports = new BinanceService();
