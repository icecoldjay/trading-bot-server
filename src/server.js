const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const MonitoringService = require("./services/MonitoringService");
const logger = require("../utils/logger");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

app.use(express.json());

// Routes
app.use("/api", routes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

// Initialize and start server
async function startServer() {
  try {
    await MonitoringService.initialize();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down server...");
  MonitoringService.shutdown();
  process.exit();
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  MonitoringService.shutdown();
  process.exit(1);
});
