/**
 * TradeExecutor Module
 * Executes buy and sell trades on the DEX
 */

const { ethers } = require("ethers");
const config = require("../../../config");
const logger = require("../../../utils/logger");
const contracts = require("../../../utils/contracts");
const DexPriceMonitor = require("../monitoring/DexPriceMonitor");
const CapitalAllocator = require("../risk/CapitalAllocator");
const SlippageController = require("../risk/SlippageController");

class TradeExecutor {
  constructor() {
    this.transactions = [];
    this.callbacks = {
      onTradeExecuted: null,
      onTradeError: null,
    };
  }

  /**
   * Initialize the trade executor
   */
  async initialize() {
    try {
      logger.info("Initializing trade executor...");

      // Approve token spending if needed
      await this.approveTokens();

      logger.info("Trade executor initialized successfully");
      return true;
    } catch (error) {
      logger.error("Failed to initialize trade executor:", error.message);
      return false;
    }
  }

  /**
   * Approve tokens for DEX trading
   */
  async approveTokens() {
    try {
      logger.info("Approving tokens for DEX trading...");

      // Approve WBTC
      const wbtcAllowance = await contracts.wbtcToken.allowance(
        contracts.wallet.address,
        config.dex.routerAddress
      );

      if (wbtcAllowance.lt(ethers.parseUnits("1", 8))) {
        logger.info("Approving WBTC for trading...");
        const wbtcTx = await contracts.wbtcToken.approve(
          config.dex.routerAddress,
          ethers.constants.MaxUint256
        );
        await wbtcTx.wait();
        logger.info("WBTC approved for trading");
      } else {
        logger.info("WBTC already approved for trading");
      }

      // Approve BUSD
      const busdAllowance = await contracts.busdToken.allowance(
        contracts.wallet.address,
        config.dex.routerAddress
      );

      if (busdAllowance.lt(ethers.parseUnits("1000", 18))) {
        logger.info("Approving BUSD for trading...");
        const busdTx = await contracts.busdToken.approve(
          config.dex.routerAddress,
          ethers.constants.MaxUint256
        );
        await busdTx.wait();
        logger.info("BUSD approved for trading");
      } else {
        logger.info("BUSD already approved for trading");
      }

      return true;
    } catch (error) {
      logger.error("Error approving tokens:", error.message);
      throw error;
    }
  }

  /**
   * Execute a buy order (BUSD -> WBTC)
   */
  async executeBuy() {
    try {
      logger.info("Executing buy order...");

      // Get available capital for trade
      const tradeAmount = await CapitalAllocator.getTradeAmount("buy");

      if (tradeAmount.lte(0)) {
        logger.warn("Insufficient BUSD balance for trading");
        return false;
      }

      // Prepare swap parameters
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      const path = [config.tokens.BUSD, config.tokens.WBTC];

      // Get expected amount out with price impact
      const amountsOut = await contracts.pancakeRouter.getAmountsOut(
        tradeAmount,
        path
      );
      const expectedWbtc = amountsOut[1];

      // Apply slippage tolerance
      const minAmountOut = SlippageController.applySlippage(
        expectedWbtc,
        "buy"
      );

      // Execute swap
      logger.info(
        `Buying WBTC with ${ethers.utils.formatUnits(tradeAmount, 18)} BUSD`
      );
      logger.info(
        `Expecting at least ${ethers.utils.formatUnits(minAmountOut, 8)} WBTC`
      );

      const swapTx = await contracts.pancakeRouter.swapExactTokensForTokens(
        tradeAmount,
        minAmountOut,
        path,
        contracts.wallet.address,
        deadline,
        {
          gasPrice: config.bsc.gasPrice,
          gasLimit: config.bsc.gasLimit,
        }
      );

      logger.info(`Swap transaction submitted: ${swapTx.hash}`);
      const receipt = await swapTx.wait();

      // Record transaction
      const tradeRecord = {
        type: "buy",
        txHash: swapTx.hash,
        amountIn: ethers.utils.formatUnits(tradeAmount, 18),
        amountOut: ethers.utils.formatUnits(amountsOut[1], 8),
        timestamp: new Date(),
        blockNumber: receipt.blockNumber,
      };

      this.transactions.push(tradeRecord);

      // Notify callback
      if (this.callbacks.onTradeExecuted) {
        this.callbacks.onTradeExecuted(tradeRecord);
      }

      return tradeRecord;
    } catch (error) {
      logger.error("Error executing buy order:", error.message);

      if (this.callbacks.onTradeError) {
        this.callbacks.onTradeError("buy", error);
      }

      throw error;
    }
  }

  /**
   * Execute a sell order (WBTC -> BUSD)
   */
  async executeSell() {
    try {
      logger.info("Executing sell order...");

      // Get available WBTC balance
      const wbtcBalance = await contracts.wbtcToken.balanceOf(
        contracts.wallet.address
      );

      if (wbtcBalance.lte(0)) {
        logger.warn("No WBTC balance to sell");
        return false;
      }

      // Prepare swap parameters
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      const path = [config.tokens.WBTC, config.tokens.BUSD];

      // Get expected amount out with price impact
      const amountsOut = await contracts.pancakeRouter.getAmountsOut(
        wbtcBalance,
        path
      );
      const expectedBusd = amountsOut[1];

      // Apply slippage tolerance
      const minAmountOut = SlippageController.applySlippage(
        expectedBusd,
        "sell"
      );

      // Execute swap
      logger.info(`Selling ${ethers.utils.formatUnits(wbtcBalance, 8)} WBTC`);
      logger.info(
        `Expecting at least ${ethers.utils.formatUnits(minAmountOut, 18)} BUSD`
      );

      const swapTx = await contracts.pancakeRouter.swapExactTokensForTokens(
        wbtcBalance,
        minAmountOut,
        path,
        contracts.wallet.address,
        deadline,
        {
          gasPrice: config.bsc.gasPrice,
          gasLimit: config.bsc.gasLimit,
        }
      );

      logger.info(`Swap transaction submitted: ${swapTx.hash}`);
      const receipt = await swapTx.wait();

      // Record transaction
      const tradeRecord = {
        type: "sell",
        txHash: swapTx.hash,
        amountIn: ethers.utils.formatUnits(wbtcBalance, 8),
        amountOut: ethers.utils.formatUnits(amountsOut[1], 18),
        timestamp: new Date(),
        blockNumber: receipt.blockNumber,
      };

      this.transactions.push(tradeRecord);

      // Notify callback
      if (this.callbacks.onTradeExecuted) {
        this.callbacks.onTradeExecuted(tradeRecord);
      }

      return tradeRecord;
    } catch (error) {
      logger.error("Error executing sell order:", error.message);

      if (this.callbacks.onTradeError) {
        this.callbacks.onTradeError("sell", error);
      }

      throw error;
    }
  }

  /**
   * Register a callback for trade execution
   * @param {Function} callback Function to call when trade is executed
   */
  onTradeExecuted(callback) {
    this.callbacks.onTradeExecuted = callback;
  }

  /**
   * Register a callback for trade errors
   * @param {Function} callback Function to call when trade error occurs
   */
  onTradeError(callback) {
    this.callbacks.onTradeError = callback;
  }

  /**
   * Get transaction history
   * @returns {Array} Array of transaction records
   */
  getTransactionHistory() {
    return this.transactions;
  }
}

module.exports = new TradeExecutor();
