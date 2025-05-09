// src/controllers/IndicatorController.ts
const MonitoringService = require("../services/MonitoringService");
const logger = require("../../utils/logger");

module.exports = {
  getIndicators: async (req, res) => {
    try {
      const data = MonitoringService.getCurrentData();

      res.json({
        rsi: data.centralized.indicators.rsi,
        ema: data.centralized.indicators.ema,
      });
    } catch (error) {
      logger.error("Failed to fetch indicators:", error);
      res.status(500).json({
        error: "Failed to fetch indicators",
        details: error.message,
      });
    }
  },
};
