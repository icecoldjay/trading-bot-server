/**
 * SignalDetector Module
 * Detects buy and sell signals based on indicators and price differences
 */

const config = require("../../config");
const logger = require("../../utils/logger");
const BinanceService = require("../monitoring/BinanceService");
const DexPriceMonitor = require("../monitoring/DexPriceMonitor");
const IndicatorCalculator = require("../monitoring/IndicatorCalculator");

class SignalDetector {
  constructor() {
    this.lastSignal = {
      type: null, // 'buy' or 'sell'
      timestamp: null,
    };
    this.callbacks = {
      onBuySignal: null,
      onSellSignal: null,
    };
  }

  /**
   * Initialize the signal detector
   */
  initialize() {
    logger.info("Initializing signal detector...");
    return true;
  }

  /**
   * Check for buy signal
   * @param {string} currentPosition Current trading position ('long' or null)
   * @returns {boolean} True if buy signal is detected
   */
  checkBuySignal(currentPosition) {
    // Only check for buy signal if we're not in a position
    if (currentPosition !== null) {
      return false;
    }

    const binancePrice = BinanceService.getCurrentPrice();
    const dexPrice = DexPriceMonitor.getCurrentPrice();

    // Buy conditions:
    // 1. RSI < 30 (oversold)
    // 2. Binance price crosses above EMA
    // 3. DEX price lags behind Binance by at least 0.6%

    const rsiOversold = IndicatorCalculator.isRsiOversold();
    const priceAboveEma = IndicatorCalculator.isPriceAboveEma(binancePrice);

    // Calculate price gap as percentage
    const priceGapPercent = (binancePrice - dexPrice) / dexPrice;
    const sufficientGap = priceGapPercent > config.trading.minProfitThreshold;

    logger.debug(
      `Buy signal check: RSI oversold? ${rsiOversold}, Price > EMA? ${priceAboveEma}, Price gap: ${(
        priceGapPercent * 100
      ).toFixed(2)}%`
    );

    if (rsiOversold && priceAboveEma && sufficientGap) {
      logger.info("BUY SIGNAL DETECTED!");

      // Update last signal
      this.lastSignal = {
        type: "buy",
        timestamp: new Date(),
        data: {
          binancePrice,
          dexPrice,
          rsi: IndicatorCalculator.getIndicators().rsi,
          ema: IndicatorCalculator.getIndicators().ema,
          priceGap: priceGapPercent,
        },
      };

      // Call callback if registered
      if (this.callbacks.onBuySignal) {
        this.callbacks.onBuySignal(this.lastSignal);
      }

      return true;
    }

    return false;
  }

  /**
   * Check for sell signal
   * @param {string} currentPosition Current trading position ('long' or null)
   * @returns {boolean} True if sell signal is detected
   */
  checkSellSignal(currentPosition) {
    // Only check for sell signal if we're in a position
    if (currentPosition !== "long") {
      return false;
    }

    const binancePrice = BinanceService.getCurrentPrice();
    const dexPrice = DexPriceMonitor.getCurrentPrice();

    // Sell conditions:
    // 1. RSI > 70 (overbought)
    // 2. Binance price drops below EMA
    // 3. DEX price leads Binance by at least 0.6%

    const rsiOverbought = IndicatorCalculator.isRsiOverbought();
    const priceBelowEma = IndicatorCalculator.isPriceBelowEma(binancePrice);

    // Calculate price gap as percentage (for sell, DEX price should be higher)
    const priceGapPercent = (dexPrice - binancePrice) / binancePrice;
    const sufficientGap = priceGapPercent > config.trading.minProfitThreshold;

    logger.debug(
      `Sell signal check: RSI overbought? ${rsiOverbought}, Price < EMA? ${priceBelowEma}, Price gap: ${(
        priceGapPercent * 100
      ).toFixed(2)}%`
    );

    if (rsiOverbought && priceBelowEma && sufficientGap) {
      logger.info("SELL SIGNAL DETECTED!");

      // Update last signal
      this.lastSignal = {
        type: "sell",
        timestamp: new Date(),
        data: {
          binancePrice,
          dexPrice,
          rsi: IndicatorCalculator.getIndicators().rsi,
          ema: IndicatorCalculator.getIndicators().ema,
          priceGap: priceGapPercent,
        },
      };

      // Call callback if registered
      if (this.callbacks.onSellSignal) {
        this.callbacks.onSellSignal(this.lastSignal);
      }

      return true;
    }

    return false;
  }

  /**
   * Register a callback for buy signals
   * @param {Function} callback Function to call on buy signal
   */
  onBuySignal(callback) {
    this.callbacks.onBuySignal = callback;
  }

  /**
   * Register a callback for sell signals
   * @param {Function} callback Function to call on sell signal
   */
  onSellSignal(callback) {
    this.callbacks.onSellSignal = callback;
  }

  /**
   * Get the last detected signal
   * @returns {Object} Last signal information
   */
  getLastSignal() {
    return this.lastSignal;
  }
}

module.exports = new SignalDetector();
