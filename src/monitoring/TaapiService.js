/**
 * TaapiService Module
 * Handles fetching market data and technical indicators from TAAPI.io
 * Using direct axios calls instead of the TAAPI npm package due to authentication issues
 * Implements proper rate limiting for free tier (1 request per 15 seconds)
 */

const axios = require("axios");
const config = require("../../config");
const logger = require("../../utils/logger");

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
    this.updateInterval = null;
    this.callbacks = {
      onDataUpdate: null,
    };

    // Rate limiting configuration
    this.rateLimiting = {
      queue: [],
      processing: false,
      lastRequestTime: 0,
      minTimeBetweenRequests: 15000, // 15 seconds minimum between requests for free tier
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
      // Get initial data using the new sequential fetch approach
      await this.fetchDataSequentially();

      // Start polling for updates
      this.startPolling();

      logger.info("TAAPI.io service initialized successfully");
      return true;
    } catch (error) {
      logger.error("Failed to initialize TAAPI.io service:", error.message);
      logger.error(error.stack); // Log the full stack trace for more details
      throw error;
    }
  }

  /**
   * Start polling for data updates
   */
  startPolling() {
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Set up interval for data updates
    this.updateInterval = setInterval(async () => {
      try {
        await this.fetchDataSequentially();
      } catch (error) {
        logger.error("Error fetching data from TAAPI.io:", error.message);
      }
    }, config.taapi.refreshInterval);

    logger.info(
      `TAAPI.io polling started with ${
        config.taapi.refreshInterval / 1000
      }s interval`
    );
  }

  /**
   * Make a rate-limited API request
   * Ensures requests are spaced out to avoid 429 errors
   * @param {Function} requestFn The function that makes the actual request
   * @returns {Promise} Promise that resolves with the request result
   */
  async makeRateLimitedRequest(requestFn) {
    return new Promise((resolve, reject) => {
      // Add this request to the queue
      this.rateLimiting.queue.push({ requestFn, resolve, reject });

      // Process the queue if not already processing
      if (!this.rateLimiting.processing) {
        this.processRequestQueue();
      }
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  async processRequestQueue() {
    if (this.rateLimiting.queue.length === 0) {
      this.rateLimiting.processing = false;
      return;
    }

    this.rateLimiting.processing = true;

    // Get the next request from the queue
    const { requestFn, resolve, reject } = this.rateLimiting.queue.shift();

    // Calculate time to wait before making the request
    const now = Date.now();
    const timeSinceLastRequest = now - this.rateLimiting.lastRequestTime;
    const timeToWait = Math.max(
      0,
      this.rateLimiting.minTimeBetweenRequests - timeSinceLastRequest
    );

    if (timeToWait > 0) {
      logger.debug(
        `Rate limiting: waiting ${timeToWait}ms before next request`
      );
      await new Promise((r) => setTimeout(r, timeToWait));
    }

    // Make the request
    try {
      const result = await requestFn();
      this.rateLimiting.lastRequestTime = Date.now();
      resolve(result);
    } catch (error) {
      // If we get a 429, increase the wait time for future requests
      if (error.response && error.response.status === 429) {
        this.rateLimiting.minTimeBetweenRequests += 1000; // Add 1 second to the wait time
        logger.warn(
          `Rate limit hit. Increasing wait time to ${this.rateLimiting.minTimeBetweenRequests}ms`
        );
      }
      reject(error);
    }

    // Process the next request in the queue
    setTimeout(() => this.processRequestQueue(), 100);
  }

  /**
   * Fetch data sequentially to respect rate limits
   * Makes one API call at a time with proper delays between them
   */
  async fetchDataSequentially() {
    try {
      logger.debug("Starting sequential data fetch...");

      // Step 1: Fetch price
      const priceData = await this.makeRateLimitedRequest(() =>
        this.fetchPrice()
      );
      logger.debug(`Price fetched: ${priceData.toFixed(2)}`);

      // Update current price data immediately
      this.currentData.price = priceData;
      this.currentData.lastUpdated = new Date();

      // Step 2: Fetch RSI after price
      const rsiData = await this.makeRateLimitedRequest(() => this.fetchRsi());
      logger.debug(`RSI fetched: ${rsiData.value.toFixed(2)}`);

      // Update RSI data
      this.currentData.indicators.rsi = rsiData.value;
      this.currentData.lastUpdated = new Date();

      // Step 3: Fetch EMA last
      const emaData = await this.makeRateLimitedRequest(() => this.fetchEma());
      logger.debug(`EMA fetched: ${emaData.value.toFixed(2)}`);

      // Final update with all data
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
      logger.error(
        "Error fetching data sequentially from TAAPI.io:",
        error.message
      );
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
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      logger.info("TAAPI.io service shutdown");
    }
  }
}

module.exports = new TaapiService();
