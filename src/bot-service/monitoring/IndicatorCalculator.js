/**
 * IndicatorCalculator Module
 * Calculates technical indicators based on price data
 */

const technicalindicators = require("technicalindicators");
const config = require("../../../config");
const logger = require("../../../utils/logger");

class IndicatorCalculator {
  constructor() {
    this.indicators = {
      rsi: null,
      ema: null,
      previousRsi: null,
      previousEma: null,
    };
    this.callbacks = {
      onIndicatorsUpdated: null,
    };
  }

  /**
   * Initialize the indicator calculator
   * @param {Array} historicalPrices Initial historical prices
   */
  initialize(historicalPrices) {
    if (historicalPrices && historicalPrices.length > 0) {
      this.updateIndicators(historicalPrices);
      logger.info("Indicator calculator initialized with historical data");
      return true;
    } else {
      logger.warn("No historical data provided for indicator initialization");
      return false;
    }
  }

  /**
   * Update indicators with new price data
   * @param {Array} prices Array of price data
   */
  updateIndicators(prices) {
    if (!prices || prices.length < config.indicators.rsi.period) {
      logger.warn(
        `Not enough price data to calculate indicators. Need at least ${config.indicators.rsi.period} data points.`
      );
      return false;
    }

    // Store previous values for trend detection
    this.indicators.previousRsi = this.indicators.rsi;
    this.indicators.previousEma = this.indicators.ema;

    // Calculate RSI
    const rsiInput = {
      values: prices,
      period: config.indicators.rsi.period,
    };
    const rsiValues = technicalindicators.RSI.calculate(rsiInput);
    this.indicators.rsi = rsiValues[rsiValues.length - 1];

    // Calculate EMA
    const emaInput = {
      values: prices,
      period: config.indicators.ema.period,
    };
    const emaValues = technicalindicators.EMA.calculate(emaInput);
    this.indicators.ema = emaValues[emaValues.length - 1];

    logger.debug(
      `Updated indicators: RSI = ${this.indicators.rsi.toFixed(
        2
      )}, EMA = ${this.indicators.ema.toFixed(2)}`
    );

    // Notify callback if registered
    if (this.callbacks.onIndicatorsUpdated) {
      this.callbacks.onIndicatorsUpdated({ ...this.indicators });
    }

    return true;
  }

  /**
   * Get the current indicators
   * @returns {Object} Current indicator values
   */
  getIndicators() {
    return { ...this.indicators };
  }

  /**
   * Check if RSI is in oversold territory
   * @returns {Boolean} True if RSI is oversold
   */
  isRsiOversold() {
    return (
      this.indicators.rsi !== null &&
      this.indicators.rsi < config.indicators.rsi.oversold
    );
  }

  /**
   * Check if RSI is in overbought territory
   * @returns {Boolean} True if RSI is overbought
   */
  isRsiOverbought() {
    return (
      this.indicators.rsi !== null &&
      this.indicators.rsi > config.indicators.rsi.overbought
    );
  }

  /**
   * Check if price is above EMA
   * @param {number} currentPrice Current price
   * @returns {Boolean} True if price is above EMA
   */
  isPriceAboveEma(currentPrice) {
    return this.indicators.ema !== null && currentPrice > this.indicators.ema;
  }

  /**
   * Check if price is below EMA
   * @param {number} currentPrice Current price
   * @returns {Boolean} True if price is below EMA
   */
  isPriceBelowEma(currentPrice) {
    return this.indicators.ema !== null && currentPrice < this.indicators.ema;
  }

  /**
   * Check if RSI is rising from oversold
   * @returns {Boolean} True if RSI is rising from oversold
   */
  isRsiRisingFromOversold() {
    return (
      this.indicators.previousRsi !== null &&
      this.indicators.rsi !== null &&
      this.indicators.previousRsi < this.indicators.rsi &&
      this.indicators.previousRsi < config.indicators.rsi.oversold
    );
  }

  /**
   * Check if RSI is falling from overbought
   * @returns {Boolean} True if RSI is falling from overbought
   */
  isRsiFallingFromOverbought() {
    return (
      this.indicators.previousRsi !== null &&
      this.indicators.rsi !== null &&
      this.indicators.previousRsi > this.indicators.rsi &&
      this.indicators.previousRsi > config.indicators.rsi.overbought
    );
  }

  /**
   * Register a callback for indicator updates
   * @param {Function} callback Function to call when indicators are updated
   */
  onIndicatorsUpdated(callback) {
    this.callbacks.onIndicatorsUpdated = callback;
  }
}

module.exports = new IndicatorCalculator();
