const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const oauthController = require("../controllers/oauth.controller");
const portalAuth = require("../services/portalAuth.service");
const { dashboardAuthPage, dashboardAuthApi, login, logout } = require("../middleware/dashboardAuth");

router.get("/login", (req, res) => res.render("dashboard-login.ejs", {
  error: null,
  usePortal: portalAuth.isPortalAuthEnabled()
}));
router.post("/login", login);
router.post("/logout", logout);

router.get("/", dashboardAuthPage, dashboardController.showDashboard);

router.get("/api/status", dashboardAuthApi, dashboardController.getStatus);
router.get("/api/repos/preview", dashboardAuthApi, dashboardController.previewRepos);
router.post("/api/backup/now", dashboardAuthApi, dashboardController.backupNow);
router.post("/api/backup/range", dashboardAuthApi, dashboardController.backupRange);
router.get("/api/drive/files", dashboardAuthApi, dashboardController.browseDriveFiles);
router.get("/api/drive/items", dashboardAuthApi, dashboardController.browseDriveAllItems);
router.get("/api/drive/files/:fileId/download", dashboardAuthApi, dashboardController.downloadDriveFile);
router.get("/api/settings/cron", dashboardAuthApi, dashboardController.getCronSettings);
router.post("/api/settings/cron", dashboardAuthApi, dashboardController.saveCronSettings);

router.get("/oauth/connect", dashboardAuthPage, oauthController.oauthConnect);
router.get("/oauth/callback", oauthController.oauthCallback);
router.get("/api/oauth/status", dashboardAuthApi, oauthController.getOAuthStatus);
router.post("/api/oauth/disconnect", dashboardAuthApi, oauthController.oauthDisconnect);

module.exports = router;
