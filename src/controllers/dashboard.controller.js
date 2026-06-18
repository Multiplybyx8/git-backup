const dotenv = require("dotenv");
const gitModel = require("../models/git.model");
const { describeCronSchedule } = require("../helpers/cronHelper");
const driveConfig = require("../services/driveConfig");
const { listDriveBackupsByDateRange, getDriveFileDownloadStream } = require("../services/driveBrowseService");

dotenv.config();

const getGithubCredentials = () => ({
  token: process.env.GIT_TOKEN,
  version: process.env.GIT_VERSION
});

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
    driveFolderId: process.env.PARENT_FOLDER_ID,
    defaultDriveAccount: driveConfig.DEFAULT_DRIVE_ACCOUNT,
    driveAccounts: driveConfig.getDriveAccountOptions(),
    lineConfigured: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_USER_ID)
  };
};

const showDashboard = (req, res) => {
  res.render("dashboard.ejs", {
    config: getDashboardConfig()
  });
};

const getConfig = (req, res) => {
  res.json(getDashboardConfig());
};

const getStatus = (req, res) => {
  res.json(gitModel.getBackupJobStatus());
};

const previewRepos = async (req, res) => {
  try {
    const owner = req.query.owner || process.env.GIT_OWNER;
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

const resolveDriveAccountInput = (driveAccount) => {
  if (!driveAccount) {
    return { error: "กรุณาเลือก Google Drive ปลายทาง" };
  }

  if (!driveConfig.isDriveAccountConfigured(driveAccount)) {
    return { error: `Google Drive account "${driveAccount}" ไม่ถูกต้องหรือยังไม่ได้ตั้งค่า` };
  }

  return { driveAccount };
};

const backupNow = (req, res) => {
  const owner = req.body.owner || process.env.GIT_OWNER;
  const { token, version } = getGithubCredentials();
  const includeNormal = req.body.includeNormal !== false;
  const includeMirror = req.body.includeMirror !== false;
  const driveResult = resolveDriveAccountInput(req.body.driveAccount);

  if (driveResult.error) {
    return res.status(400).json({ error: driveResult.error });
  }

  const result = gitModel.startBackupNow(owner, token, version, {
    includeNormal,
    includeMirror,
    driveAccount: driveResult.driveAccount
  });

  if (!result.started) {
    return res.status(409).json(result);
  }

  res.json(result);
};

const backupRange = (req, res) => {
  const owner = req.body.owner || process.env.GIT_OWNER;
  const { from, to } = req.body;
  const { token, version } = getGithubCredentials();
  const includeNormal = req.body.includeNormal !== false;
  const includeMirror = req.body.includeMirror !== false;

  if (!from || !to) {
    return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
  }

  const driveResult = resolveDriveAccountInput(req.body.driveAccount);
  if (driveResult.error) {
    return res.status(400).json({ error: driveResult.error });
  }

  const result = gitModel.startBackupByDateRange(owner, token, version, from, to, {
    includeNormal,
    includeMirror,
    driveAccount: driveResult.driveAccount
  });

  if (!result.started) {
    return res.status(409).json(result);
  }

  res.json(result);
};

const browseDriveFiles = async (req, res) => {
  try {
    const { from, to, driveAccount } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required (YYYY-MM-DD)" });
    }

    const driveResult = resolveDriveAccountInput(driveAccount);
    if (driveResult.error) {
      return res.status(400).json({ error: driveResult.error });
    }

    const result = await listDriveBackupsByDateRange(driveResult.driveAccount, from, to);
    res.json(result);
  } catch (error) {
    console.error("Browse drive files failed:", error);
    res.status(500).json({ error: error.message || "Failed to browse Google Drive files" });
  }
};

const downloadDriveFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { driveAccount, folderPath } = req.query;

    if (!fileId) {
      return res.status(400).json({ error: "fileId is required" });
    }

    const driveResult = resolveDriveAccountInput(driveAccount);
    if (driveResult.error) {
      return res.status(400).json({ error: driveResult.error });
    }

    const { stream, name, mimeType } = await getDriveFileDownloadStream(
      driveResult.driveAccount,
      fileId,
      folderPath
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

module.exports = {
  showDashboard,
  getConfig,
  getStatus,
  previewRepos,
  backupNow,
  backupRange,
  browseDriveFiles,
  downloadDriveFile
};
