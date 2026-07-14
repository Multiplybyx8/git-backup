const crypto = require("crypto");
const portalAuth = require("../services/portalAuth.service");
require("dotenv").config();

const AUTH_COOKIE = "dashboard_auth";
const PORTAL_AUTH_COOKIE = "dashboard_portal_token";
const AUTH_SALT = "git-backup-dashboard";

const getPasswordAuthToken = () => {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return null;
  return crypto.createHmac("sha256", password).update(AUTH_SALT).digest("hex");
};

const isPasswordAuthenticated = (req) => {
  const expected = getPasswordAuthToken();
  if (!expected) return true;
  return req.cookies[AUTH_COOKIE] === expected;
};

const getPortalTokenFromRequest = (req) => {
  const fromCookie = req.cookies[PORTAL_AUTH_COOKIE];
  if (fromCookie) return String(fromCookie);

  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return "";
};

const clearAuthCookies = (res) => {
  res.clearCookie(AUTH_COOKIE);
  res.clearCookie(PORTAL_AUTH_COOKIE);
};

const setPortalAuthCookie = (res, token) => {
  res.cookie(PORTAL_AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000
  });
};

const resolvePortalAuth = async (req) => {
  const token = getPortalTokenFromRequest(req);
  if (!token) return { ok: false };

  try {
    const permissionData = await portalAuth.checkPortalPermission(token);
    return {
      ok: true,
      token,
      permissionData,
      portalUser: portalAuth.extractPortalUserInfo(permissionData)
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: error.statusCode || 401,
      message: error.message
    };
  }
};

const attachPortalUser = (req, authResult) => {
  if (!authResult?.ok) return;
  req.portalAuth = {
    token: authResult.token,
    permission: authResult.permissionData,
    user: authResult.portalUser
  };
};

const getLoginViewModel = (error = null) => ({
  error,
  usePortal: portalAuth.isPortalAuthEnabled()
});

const dashboardAuthPage = async (req, res, next) => {
  try {
    if (portalAuth.isPortalAuthEnabled()) {
      const token = getPortalTokenFromRequest(req);
      if (token) {
        const authResult = await resolvePortalAuth(req);
        if (authResult.ok) {
          attachPortalUser(req, authResult);
          return next();
        }
        clearAuthCookies(res);
        const message = authResult.statusCode === 401
          ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"
          : "ไม่สามารถตรวจสอบสิทธิ์จาก Portal ได้";
        return res.render("dashboard-login.ejs", getLoginViewModel(message));
      }
      return res.render("dashboard-login.ejs", getLoginViewModel());
    }

    if (isPasswordAuthenticated(req)) return next();
    return res.render("dashboard-login.ejs", getLoginViewModel());
  } catch (error) {
    console.error("dashboardAuthPage failed:", error);
    return res.status(500).render("dashboard-login.ejs", getLoginViewModel("ไม่สามารถตรวจสอบสิทธิ์ได้"));
  }
};

const dashboardAuthApi = async (req, res, next) => {
  try {
    if (portalAuth.isPortalAuthEnabled()) {
      const token = getPortalTokenFromRequest(req);
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const authResult = await resolvePortalAuth(req);
      if (!authResult.ok) {
        clearAuthCookies(res);
        return res.status(401).json({ error: "Unauthorized" });
      }

      attachPortalUser(req, authResult);
      return next();
    }

    if (isPasswordAuthenticated(req)) return next();
    return res.status(401).json({ error: "Unauthorized" });
  } catch (error) {
    console.error("dashboardAuthApi failed:", error);
    return res.status(500).json({ error: "Authentication check failed" });
  }
};

const login = async (req, res) => {
  if (portalAuth.isPortalAuthEnabled()) {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.render("dashboard-login.ejs", getLoginViewModel("กรุณากรอก username และ password"));
    }

    try {
      const token = await portalAuth.loginToPortal(username, password);
      await portalAuth.checkPortalPermission(token);
      clearAuthCookies(res);
      setPortalAuthCookie(res, token);
      return res.redirect("/dashboard");
    } catch (error) {
      const message = error.statusCode === 401
        ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
        : (error.message || "เข้าสู่ระบบไม่สำเร็จ");
      return res.render("dashboard-login.ejs", getLoginViewModel(message));
    }
  }

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return res.redirect("/dashboard");
  }

  if (req.body.password !== password) {
    return res.render("dashboard-login.ejs", getLoginViewModel("รหัสผ่านไม่ถูกต้อง"));
  }

  const token = getPasswordAuthToken();
  clearAuthCookies(res);
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000
  });
  return res.redirect("/dashboard");
};

const logout = (req, res) => {
  clearAuthCookies(res);
  return res.redirect("/dashboard/login");
};

module.exports = {
  dashboardAuthPage,
  dashboardAuthApi,
  login,
  logout
};
