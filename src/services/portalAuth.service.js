const https = require("https");
const axios = require("axios");
require("dotenv").config();

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const getPortalConfig = () => ({
  portalUrl: String(process.env.PATH_API_PORTAL || "").replace(/\/$/, ""),
  projectCode: String(process.env.PROJECT_CODE || "").trim()
});

const isPortalAuthEnabled = () => {
  const { portalUrl, projectCode } = getPortalConfig();
  return Boolean(portalUrl && projectCode);
};

const portalAxiosFailureMeta = (error) => {
  const status = error?.response?.status;
  const logMessage = error?.response?.data?.message || error?.message || "Portal request failed";
  return { status, logMessage, data: error?.response?.data };
};

const loginToPortal = async (username, password) => {
  const { portalUrl, projectCode } = getPortalConfig();
  if (!portalUrl || !projectCode) {
    const err = new Error("Portal login is not configured");
    err.statusCode = 503;
    throw err;
  }

  try {
    const { data } = await axios({
      method: "post",
      url: `${portalUrl}/user/login`,
      data: { username, password, project_code: projectCode },
      httpsAgent
    });

    const token = data?.result?.token;
    if (!token) {
      const err = new Error("Invalid response from portal API");
      err.statusCode = 502;
      throw err;
    }

    return String(token);
  } catch (error) {
    if (error.statusCode) throw error;

    const { status, logMessage } = portalAxiosFailureMeta(error);
    console.error("[loginToPortal] error:", logMessage);

    if (status === 401 || status === 403) {
      const err = new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      err.statusCode = 401;
      throw err;
    }

    const err = new Error("ไม่สามารถเชื่อมต่อ Portal login ได้");
    err.statusCode = 502;
    throw err;
  }
};

const checkPortalPermission = async (token) => {
  const { portalUrl } = getPortalConfig();
  if (!portalUrl) {
    const err = new Error("Portal permission check is not configured");
    err.statusCode = 503;
    throw err;
  }

  try {
    // Portal ค้น tbltoken ด้วยค่า Authorization ทั้งก้อน (ไม่ strip Bearer)
    // แต่ login บันทึกแค่ JWT → ส่ง Authorization: <token> ไม่ใส่ Bearer
    const { data } = await axios({
      method: "get",
      url: `${portalUrl}/user/check_permission`,
      headers: { Authorization: String(token) },
      httpsAgent
    });

    return data;
  } catch (error) {
    const { status, logMessage } = portalAxiosFailureMeta(error);
    console.error("[checkPortalPermission] error:", logMessage);

    if (status === 401 || status === 403) {
      const err = new Error("Token is invalid or expired");
      err.statusCode = 401;
      throw err;
    }

    const err = new Error("Permission service unavailable");
    err.statusCode = 502;
    throw err;
  }
};

const extractPortalUserInfo = (permissionData) => {
  const raw = permissionData && typeof permissionData === "object" ? permissionData : {};
  const nested = raw.data && typeof raw.data === "object" ? raw.data : null;
  const userInfo = raw.user_info ?? nested?.user_info;
  if (!userInfo || typeof userInfo !== "object" || Array.isArray(userInfo)) return null;
  return userInfo;
};

module.exports = {
  isPortalAuthEnabled,
  loginToPortal,
  checkPortalPermission,
  extractPortalUserInfo
};
