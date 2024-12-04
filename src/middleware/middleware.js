const axios = require("axios");
const https = require("https");
require("dotenv").config();

const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  // if (apiKey !== process.env.API_KEY) {
  //   return res.status(401).json({ status: "401 Unauthorized", error: "API key is missing or invalid" });
  // }

  if (apiKey !== process.env.API_KEY) {
    const err = new Error("API key is missing or invalid");
    err.status = 401;
    return next(err);
  }

  console.log("+-----------------------------------------------+");

  console.log(`Handling API Path: ${req.originalUrl}`);
  // console.log(`Handling API Path: ${req.path}`);
  console.log("+-----------------------------------------------+");
  next();
};

const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Token not provided." });
  }

  try {
    const userInfo = await fetchUserInfo(token);
    const empCode = userInfo?.employee_code;

    if (empCode) {
      req.user_branch = await fetchUserBranch(token, empCode);
    }

    req.employee_code = empCode;
    req.user = userInfo?.user_id;
    req.user_fullname = userInfo?.user_fullnameEN;

    next();
  } catch (error) {
    handleErrorResponse(error, res);
  }
};

// Fetch user info function
const fetchUserInfo = async (token) => {
  const response = await axios.get(`${process.env.PATH_API_PORTAL}/user/check_permission`, {
    maxBodyLength: Infinity,
    headers: { Authorization: token },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  return response?.data?.user_info;
};

// Fetch user branch function
const fetchUserBranch = async (token, empCode) => {
  const response = await axios.get(`${process.env.PATH_API_PORTAL}/user/employee/${empCode}`, {
    maxBodyLength: Infinity,
    headers: { Authorization: token },
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
  });

  return response?.data?.result[0]?.branch_code;
};

// Handle error response function
const handleErrorResponse = (error, res) => {
  const errorMessage = error.response?.data?.message || error.message;
  console.error(errorMessage);
  res.status(401).json({ message: errorMessage });
};

module.exports = {
  apiKeyMiddleware,
  authenticateToken
  // authenticateAndTokenRoutes
};
