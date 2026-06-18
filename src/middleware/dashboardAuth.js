const crypto = require("crypto");
require("dotenv").config();

const AUTH_COOKIE = "dashboard_auth";
const AUTH_SALT = "git-backup-dashboard";

const getAuthToken = () => {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return null;

  return crypto.createHmac("sha256", password).update(AUTH_SALT).digest("hex");
};

const isAuthenticated = (req) => {
  const expected = getAuthToken();
  if (!expected) return true;
  return req.cookies[AUTH_COOKIE] === expected;
};

const dashboardAuthPage = (req, res, next) => {
  if (isAuthenticated(req)) return next();
  return res.render("dashboard-login.ejs", { error: null });
};

const dashboardAuthApi = (req, res, next) => {
  if (isAuthenticated(req)) return next();
  return res.status(401).json({ error: "Unauthorized" });
};

const login = (req, res) => {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return res.redirect("/dashboard");
  }

  if (req.body.password !== password) {
    return res.render("dashboard-login.ejs", { error: "รหัสผ่านไม่ถูกต้อง" });
  }

  res.cookie(AUTH_COOKIE, getAuthToken(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000
  });
  return res.redirect("/dashboard");
};

const logout = (req, res) => {
  res.clearCookie(AUTH_COOKIE);
  return res.redirect("/dashboard/login");
};

module.exports = {
  dashboardAuthPage,
  dashboardAuthApi,
  login,
  logout,
  isAuthenticated
};
