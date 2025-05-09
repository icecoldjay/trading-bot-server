const express = require("express");
const router = express.Router();

// Import controllers
const priceController = require("../controllers/PriceController");
const indicatorController = require("../controllers/IndicatorController");
const opportunityController = require("../controllers/OpportunityController");

// Price routes
router.get("/prices", priceController.getCurrentPrices);
router.get("/historical", priceController.getHistoricalPrices);

// Indicator routes
router.get("/indicators", indicatorController.getIndicators);

// Opportunity routes
router.get("/opportunity", opportunityController.getOpportunityStatus);

module.exports = router;
