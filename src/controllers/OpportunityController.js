const MonitoringService = require("../services/MonitoringService");
const logger = require("../../utils/logger");

module.exports = {
  getOpportunityStatus: async (req, res) => {
    try {
      const isBuyOpportunity = MonitoringService.isPotentialBuyOpportunity();
      const isSellOpportunity = MonitoringService.isPotentialSellOpportunity();
      const data = MonitoringService.getCurrentData();

      let type = "neutral";
      if (isBuyOpportunity) type = "buy";
      if (isSellOpportunity) type = "sell";

      // Calculate strength (0-100 scale)
      const strength = Math.min(Math.abs(data.priceDifference * 100), 100);

      res.json({
        type,
        strength,
        priceDifference: data.priceDifference,
      });
    } catch (error) {
      logger.error("Failed to fetch opportunity status:", error);
      res.status(500).json({
        error: "Failed to fetch opportunity status",
        details: error.message,
      });
    }
  },
};
