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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 33809;

const serverOptions = {
  key: fs.readFileSync(process.env.CERT_KEY),
  cert: fs.readFileSync(process.env.CERT_CERT)
};
const server = require(process.env.HTTP_PROTOCOL).createServer(serverOptions, app);

app.use(
  cors({
    origin: "*", // Adjust origins if necessary
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.set("views", path.join(__dirname, "./src/views"));
app.set("view engine", "ejs");

app.use((req, res, next) => {
  loggerApi.addContext("ip", req.ip);
  loggerApi.addContext("method", req.method);
  loggerApi.addContext("url", req.url);
  next();
});

app.use(apiKeyMiddleware);
app.use("/order", orderRouter);

app.get("/", (req, res) => res.render("successed.ejs"));
app.get("/favicon.ico", (req, res) => res.sendStatus(204));

app.use((req, res, next) => next(createError(404))); // 404 handler
app.use((err, req, res, next) => {
  const isDevelopment = req.app.get("env") === "development";
  res.locals = {
    message: err.message,
    stack: isDevelopment ? err.stack : null,
    status: err.status || 500,
    error: isDevelopment ? err : {}
  };
  res.status(res.locals.status).render("404.ejs", { title: "Page Not Found" });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
