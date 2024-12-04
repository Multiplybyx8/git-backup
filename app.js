// Required modules and configuration
const createError = require("http-errors");
const fs = require("fs");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const { api: loggerApi } = require("./src/middleware/logger");
const orderRouter = require("./src/routes/order.routes");
const { apiKeyMiddleware } = require("./src/middleware/middleware");

// Load environment variables
dotenv.config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 33809;

// CORS configuration
const corsOptions = {
  // origin: ["https://uat.multiplyby8.site:32905", "https://uat.multiplyby8.site:34373"],
  origin: "*",
  credentials: true
};

// Server configuration
const options = {
  key: fs.readFileSync(process.env.CERT_KEY),
  cert: fs.readFileSync(process.env.CERT_CERT)
};
const server = require(process.env.HTTP_PROTOCOL).createServer(options, app);

// Middleware setup
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "./src/views"));
app.set("view engine", "ejs");

// Logger setup
app.use((req, res, next) => {
  loggerApi.addContext("ip", req.ip);
  loggerApi.addContext("method", req.method);
  loggerApi.addContext("url", req.url);
  next();
});

// API Key middleware
// app.use(apiKeyMiddleware);

// Routes
app.use("/order", orderRouter);

// Root route
app.get("/", (req, res) => res.render("successed.ejs"));
app.get("/favicon.ico", (req, res) => res.status(204));

// Error handling
app.use((req, res, next) => {
  const err = createError(404);
  next(err);
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.stack = err.stack;
  res.locals.status = err.status;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.render("404.ejs", { title: "Page Not Found" });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export app
module.exports = app;
