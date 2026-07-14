const dotenv = require("dotenv");
const gitModel = require("../models/git.model");
const { describeCronSchedule } = require("../helpers/cronHelper");
const driveConfig = require("../services/driveConfig");
const backupSettings = require("../services/backupSettings");
const { listDriveBackupsByDateRange, listDriveItemsByCreateDate, getDriveFileDownloadStream } = require("../services/driveBrowseService");

dotenv.config();

const getGithubCredentials = () => ({
  token: process.env.GIT_TOKEN,
  version: process.env.GIT_VERSION
});

const getGitOwner = () => process.env.GIT_OWNER;

const getDashboardConfig = () => {
  const cronSchedule = process.env.CRON_SCHEDULE;
  const timezone = "Asia/Bangkok";

  return {
    owner: process.env.GIT_OWNER,
    days: process.env.DAYS,
    cronSchedule,
    cronScheduleLabel: describeCronSchedule(cronSchedule, timezone),
    port: process.env.PORT || 33776,
    timezone,
    driveAccounts: driveConfig.getDriveAccountOptions(),
    lineConfigured: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_USER_ID),
    cronBackup: backupSettings.getCronSettingsView()
  };
};

const showDashboard = (req, res) => {
  const portalUser = req.portalAuth?.user || null;
  res.render("dashboard.ejs", {
    config: getDashboardConfig(),
    portalUser
  });
};

const getStatus = (req, res) => {
  res.json(gitModel.getBackupJobStatus());
};

const previewRepos = async (req, res) => {
  try {
    const owner = getGitOwner();
    const { from, to } = req.query;
    const { token, version } = getGithubCredentials();

    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }

    const result = await gitModel.PreviewRepositories(owner, token, version, {
      mode: "range",
      dateFrom: from,
      dateTo: to
    });

    res.json(result);
  } catch (error) {
    console.error("Preview repos failed:", error);
    res.status(500).json({ error: "Failed to preview repositories" });
  }
};

const resolveDriveDestinationInput = (driveDestination, driveAccount) => {
  const input = driveDestination || driveAccount;
  if (!input) {
    return { error: "กรุณาเลือก Google Drive ปลายทาง" };
  }

  const destination = driveConfig.parseDestinationId(input);
  if (!destination) {
    return { error: `ปลายทาง Google Drive "${input}" ไม่ถูกต้อง` };
  }

  if (!driveConfig.isDriveDestinationConfigured(destination.destinationId)) {
    const mode = driveConfig.getAuthMode(destination.accountKey);
    if (mode === "oauth" && driveConfig.isDriveAccountSetup(destination.accountKey)) {
      return { error: `กรุณาเชื่อมต่อ Google Drive (OAuth) สำหรับ "${destination.accountKey}" ก่อนเริ่ม Backup` };
    }
    return { error: `Google Drive "${driveConfig.getDriveDestinationLabel(destination.destinationId)}" ไม่พร้อมใช้งาน` };
  }

  return { driveDestination: destination.destinationId };
};

const backupNow = (req, res) => {
  const owner = getGitOwner();
  const { token, version } = getGithubCredentials();
  const includeNormal = req.body.includeNormal !== false;
  const includeMirror = req.body.includeMirror !== false;
  const driveResult = resolveDriveDestinationInput(req.body.driveDestination, req.body.driveAccount);

  if (driveResult.error) {
    return res.status(400).json({ error: driveResult.error });
  }

  const result = gitModel.startBackupNow(owner, token, version, {
    includeNormal,
    includeMirror,
    driveDestination: driveResult.driveDestination
  });

  if (!result.started) {
    return res.status(409).json(result);
  }

  res.json(result);
};

const backupRange = (req, res) => {
  const owner = getGitOwner();
  const { from, to } = req.body;
  const { token, version } = getGithubCredentials();
  const includeNormal = req.body.includeNormal !== false;
  const includeMirror = req.body.includeMirror !== false;

  if (!from || !to) {
    return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
  }

  const driveResult = resolveDriveDestinationInput(req.body.driveDestination, req.body.driveAccount);
  if (driveResult.error) {
    return res.status(400).json({ error: driveResult.error });
  }

  const result = gitModel.startBackupByDateRange(owner, token, version, from, to, {
    includeNormal,
    includeMirror,
    driveDestination: driveResult.driveDestination
  });

  if (!result.started) {
    return res.status(409).json(result);
  }

  res.json(result);
};

const browseDriveFiles = async (req, res) => {
  try {
    const { from, to, driveDestination, driveAccount } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }

    const driveResult = resolveDriveDestinationInput(driveDestination, driveAccount);
    if (driveResult.error) {
      return res.status(400).json({ error: driveResult.error });
    }

    const result = await listDriveBackupsByDateRange(driveResult.driveDestination, from, to);
    res.json(result);
  } catch (error) {
    console.error("Browse drive files failed:", error);
    res.status(500).json({ error: error.message || "Failed to browse Google Drive files" });
  }
};

const browseDriveAllItems = async (req, res) => {
  try {
    const { from, to, driveDestination, driveAccount } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }

    const driveResult = resolveDriveDestinationInput(driveDestination, driveAccount);
    if (driveResult.error) {
      return res.status(400).json({ error: driveResult.error });
    }

    const result = await listDriveItemsByCreateDate(driveResult.driveDestination, from, to);
    res.json(result);
  } catch (error) {
    console.error("Browse all drive items failed:", error);
    res.status(500).json({ error: error.message || "Failed to browse Google Drive items" });
  }
};

const downloadDriveFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { driveDestination, driveAccount, folderPath } = req.query;

    if (!fileId) {
      return res.status(400).json({ error: "fileId is required" });
    }

    const driveResult = resolveDriveDestinationInput(driveDestination, driveAccount);
    if (driveResult.error) {
      return res.status(400).json({ error: driveResult.error });
    }

    const { stream, name, mimeType } = await getDriveFileDownloadStream(
      driveResult.driveDestination,
      fileId,
      folderPath,
      { verifyParent: req.query.mode === "all" || !folderPath }
    );

    const safeName = name.replace(/[^\w\s.\-()[\]]/g, "_");
    res.setHeader("Content-Type", mimeType || "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(name)}`
    );

    stream.on("error", (err) => {
      console.error("Drive download stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Download failed" });
      } else {
        res.end();
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error("Download drive file failed:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Failed to download file"
    });
  }
};

const getCronSettings = (req, res) => {
  res.json(backupSettings.getCronSettingsView());
};

const saveCronSettings = (req, res) => {
  try {
    const driveResult = resolveDriveDestinationInput(req.body.driveDestination, req.body.driveAccount);
    if (driveResult.error) {
      return res.status(400).json({ error: driveResult.error });
    }

    const result = backupSettings.saveCronSettings({
      driveDestination: driveResult.driveDestination,
      includeNormal: req.body.includeNormal,
      includeMirror: req.body.includeMirror
    });

    res.json(result);
  } catch (error) {
    console.error("Save cron settings failed:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Failed to save cron settings"
    });
  }
};

module.exports = {
  showDashboard,
  getStatus,
  previewRepos,
  backupNow,
  backupRange,
  browseDriveFiles,
  browseDriveAllItems,
  downloadDriveFile,
  getCronSettings,
  saveCronSettings
};
