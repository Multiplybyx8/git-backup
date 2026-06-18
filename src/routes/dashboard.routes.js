const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const { dashboardAuthPage, dashboardAuthApi, login, logout } = require("../middleware/dashboardAuth");

router.get("/login", (req, res) => res.render("dashboard-login.ejs", { error: null }));
router.post("/login", login);
router.post("/logout", logout);

router.get("/", dashboardAuthPage, dashboardController.showDashboard);

router.get("/api/config", dashboardAuthApi, dashboardController.getConfig);
router.get("/api/status", dashboardAuthApi, dashboardController.getStatus);
router.get("/api/repos/preview", dashboardAuthApi, dashboardController.previewRepos);
router.post("/api/backup/now", dashboardAuthApi, dashboardController.backupNow);
router.post("/api/backup/range", dashboardAuthApi, dashboardController.backupRange);
router.get("/api/drive/files", dashboardAuthApi, dashboardController.browseDriveFiles);
router.get("/api/drive/files/:fileId/download", dashboardAuthApi, dashboardController.downloadDriveFile);

module.exports = router;
