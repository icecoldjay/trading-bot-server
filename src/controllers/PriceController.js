// src/controllers/PriceController.ts
const MonitoringService = require("../services/MonitoringService");

module.exports = {
  getCurrentPrices: async (req, res) => {
    try {
      const data = MonitoringService.getCurrentData();

      res.json({
        centralized: {
          price: data.centralized.price,
          indicators: data.centralized.indicators,
        },
        dex: {
          price: data.dex.price,
        },
        priceDifference: data.priceDifference,
        timestamp: data.timestamp,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch current prices" });
    }
  },

  getHistoricalPrices: async (req, res) => {
    try {
      // In a real implementation, you would fetch historical data from your database
      // For now, we'll return sample data structure
      res.json({
        binance: [],
        dex: [],
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch historical prices" });
    }
  },
};
