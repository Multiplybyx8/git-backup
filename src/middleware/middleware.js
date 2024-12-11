const isEmpty = require("lodash.isempty");
require("dotenv").config();

const apiKeyMiddleware = (req, res, next) => {
  if (isEmpty(req.headers["key3"])) {
    const err = new Error("API key is missing or invalid");
    err.status = 401;
    return next(err);
  }

  const result = extractKey(req.headers["key3"]);

  if (result !== process.env.API_KEY) {
    const err = new Error("API key is missing or invalid");
    err.status = 401;
    return next(err);
  }

  console.log("+-----------------------------------------------+");
  console.log(`Handling API Path: ${req.originalUrl}`);
  console.log("+-----------------------------------------------+");
  // console.log(`Handling API Path: ${req.path}`);
  next();
};

const extractKey = (input) => {
  if (input.includes(":")) {
    return input.split(":")[1].trim();
  }
  return input.trim();
};

module.exports = {
  apiKeyMiddleware
};
