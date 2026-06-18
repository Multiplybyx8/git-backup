const https = require("https");
const isEmpty = require("lodash.isempty");
const { execSync } = require("child_process");
const axios = require("axios");
const { Client } = require("@line/bot-sdk");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
const backupJobState = require("../services/backupJobState");
const driveConfig = require("../services/driveConfig");

dotenv.config();

const TEMP_FOLDER = path.join(__dirname, "../temp_repos");
if (!fs.existsSync(TEMP_FOLDER)) fs.mkdirSync(TEMP_FOLDER, { recursive: true });

const isRepoInFilter = (pushedAt, filter) => {
  const pushed = new Date(pushedAt);

  if (filter.mode === "range") {
    const from = new Date(filter.dateFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(filter.dateTo);
    to.setHours(23, 59, 59, 999);
    return pushed >= from && pushed <= to;
  }

  const since = new Date();
  since.setDate(since.getDate() - filter.days);
  since.setHours(0, 0, 0, 0);
  return pushed >= since;
};

const buildDateFilter = (options = {}) => {
  if (options.mode === "range") {
    return {
      mode: "range",
      dateFrom: options.dateFrom,
      dateTo: options.dateTo
    };
  }

  return {
    mode: "days",
    days: parseInt(options.days ?? process.env.DAYS, 10)
  };
};

const runBackupForRepos = async (owner, repositories, GITHUB_TOKEN, options = {}) => {
  const {
    includeNormal = true,
    includeMirror = true,
    notifyEmpty = true,
    driveAccount = driveConfig.DEFAULT_DRIVE_ACCOUNT
  } = options;
  const driveAccountKey = driveConfig.resolveDriveAccount(driveAccount);
  const driveAccountLabel = driveConfig.getDriveAccountLabel(driveAccountKey);
  const responText = "❌ No Repository to clone!";

  if (repositories.length === 0) {
    if (notifyEmpty) await sendLineMessage(responText);
    console.log(responText);
    return {
      owner,
      total: 0,
      processed: [],
      skipped: [],
      message: responText
    };
  }

  const processed = [];
  const skipped = [];

  for (const repo of repositories) {
    const { cloneUrl, pushedAt, name } = repo;
    const repoName = name || cloneUrl.split("/").pop()?.replace(".git", "") || "unknown";
    backupJobState.setCurrentRepo(repoName);

    const { normalPath, mirrorPath } = await cloneRepo(cloneUrl, pushedAt, GITHUB_TOKEN);
    if (!normalPath && !mirrorPath) {
      skipped.push({ repo: repoName, reason: "clone failed" });
      continue;
    }

    const repoResult = { repo: repoName, normal: false, mirror: false };
    if (includeNormal && normalPath) {
      await processAndUpload(normalPath, "Normal", driveAccountKey);
      repoResult.normal = true;
    }
    if (includeMirror && mirrorPath) {
      await processAndUpload(mirrorPath, "Mirror", driveAccountKey);
      repoResult.mirror = true;
    }
    processed.push(repoResult);
  }

  const message = `Backup completed: ${processed.length} processed, ${skipped.length} skipped → ${driveAccountLabel}`;
  console.log(message);

  return {
    owner,
    driveAccount: driveAccountKey,
    driveAccountLabel,
    total: repositories.length,
    processed,
    skipped,
    message
  };
};

const GetBackupManual = async (owner, GITHUB_TOKEN, GITHUB_API_VERSION, options = {}) => {
  if (!backupJobState.acquireBackupLock("manual")) {
    return {
      owner,
      total: 0,
      processed: [],
      skipped: [],
      message: "Backup job is already running",
      running: true
    };
  }

  try {
    const filter = buildDateFilter({ mode: "days" });
    const repositories = await getRepositories(owner, GITHUB_TOKEN, GITHUB_API_VERSION, filter);
    const result = await runBackupForRepos(owner, repositories, GITHUB_TOKEN, options);
    backupJobState.releaseBackupLock(result);
    return result;
  } catch (error) {
    backupJobState.releaseBackupLock();
    throw error;
  }
};

const PreviewRepositories = async (owner, GITHUB_TOKEN, GITHUB_API_VERSION, filterOptions) => {
  const filter = buildDateFilter(filterOptions);
  const repositories = await getRepositories(owner, GITHUB_TOKEN, GITHUB_API_VERSION, filter);

  return {
    owner,
    filter,
    total: repositories.length,
    repositories: repositories.map((repo) => ({
      name: repo.name,
      pushedAt: repo.pushedAt
    }))
  };
};

const GetBackupByDateRange = async (owner, GITHUB_TOKEN, GITHUB_API_VERSION, dateFrom, dateTo, options = {}) => {
  if (!backupJobState.acquireBackupLock("range")) {
    return {
      owner,
      total: 0,
      processed: [],
      skipped: [],
      message: "Backup job is already running",
      running: true
    };
  }

  try {
    const filter = buildDateFilter({ mode: "range", dateFrom, dateTo });
    const repositories = await getRepositories(owner, GITHUB_TOKEN, GITHUB_API_VERSION, filter);
    const result = await runBackupForRepos(owner, repositories, GITHUB_TOKEN, options);
    backupJobState.releaseBackupLock(result);
    return result;
  } catch (error) {
    backupJobState.releaseBackupLock();
    throw error;
  }
};

const startBackupNow = (owner, GITHUB_TOKEN, GITHUB_API_VERSION, options = {}) => {
  if (!backupJobState.acquireBackupLock("manual")) {
    return { started: false, message: "Backup job is already running" };
  }

  setImmediate(async () => {
    try {
      const filter = buildDateFilter({ mode: "days" });
      const repositories = await getRepositories(owner, GITHUB_TOKEN, GITHUB_API_VERSION, filter);
      const result = await runBackupForRepos(owner, repositories, GITHUB_TOKEN, options);
      backupJobState.releaseBackupLock(result);
    } catch (error) {
      console.error("Background backup (now) failed:", error);
      backupJobState.releaseBackupLock();
    }
  });

  return { started: true, message: "Backup started" };
};

const startBackupByDateRange = (owner, GITHUB_TOKEN, GITHUB_API_VERSION, dateFrom, dateTo, options = {}) => {
  if (!backupJobState.acquireBackupLock("range")) {
    return { started: false, message: "Backup job is already running" };
  }

  setImmediate(async () => {
    try {
      const filter = buildDateFilter({ mode: "range", dateFrom, dateTo });
      const repositories = await getRepositories(owner, GITHUB_TOKEN, GITHUB_API_VERSION, filter);
      const result = await runBackupForRepos(owner, repositories, GITHUB_TOKEN, options);
      backupJobState.releaseBackupLock(result);
    } catch (error) {
      console.error("Background backup (range) failed:", error);
      backupJobState.releaseBackupLock();
    }
  });

  return { started: true, message: "Backup started" };
};

const processAndUpload = async (repoPath, type, driveAccount) => {
  const repoName = path.basename(repoPath);
  const repoYearMonthDayPath = path.dirname(repoPath);

  const { year, month, day, dateSuffix } = await extractDateParts(repoYearMonthDayPath);
  const zipFileName = `${repoName}-${dateSuffix}.zip`;
  const zipPath = path.join(repoYearMonthDayPath, zipFileName);

  console.log(`📦 Compressing (${type}): ${zipFileName}`);
  await createZip(repoYearMonthDayPath, repoName, zipPath);

  await uploadToGoogleDrive(zipPath, zipFileName, year, month, day, driveAccount);

  await cleanupFiles(repoPath, zipPath);
};

const getRepositories = async (owner, GITHUB_TOKEN, GITHUB_API_VERSION, filterOptions = {}) => {
  const perPage = 100;
  let page = 1;
  const repos = [];
  const filter = buildDateFilter(filterOptions);
  console.log("Repository filter:", filter);

  try {
    while (true) {
      const response = await axios.get(`https://api.github.com/user/repos`, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "X-GitHub-Api-Version": GITHUB_API_VERSION
        },
        params: { per_page: perPage, page }
      });

      if (!Array.isArray(response.data) || response.data.length === 0) break;

      repos.push(
        ...response.data
          .filter((repo) => isRepoInFilter(repo.pushed_at, filter))
          .map((repo) => ({
            name: repo.name,
            cloneUrl: repo.clone_url,
            pushedAt: repo.pushed_at
          }))
      );

      if (response.data.length < perPage) break;
      page++;
    }

    return repos;
  } catch (error) {
    console.error("❌ Unable to fetch repos:", error.message);
    return [];
  }
};

const cloneRepo = async (repoUrl, pushedAt, GITHUB_TOKEN) => {
  const { year, month, day } = extractDatePartsFromDate(pushedAt);
  const repoName = repoUrl.split("/").pop()?.replace(".git", "") || "";
  const baseFolder = path.join(TEMP_FOLDER, year.toString(), month.toString(), day.toString());

  await createFolderIfNotExist(baseFolder);

  const normalCloneSuccess = await cloneRepoType(repoUrl, baseFolder, repoName, false, GITHUB_TOKEN);
  const mirrorCloneSuccess = await cloneRepoType(repoUrl, baseFolder, repoName, true, GITHUB_TOKEN);

  return {
    normalPath: normalCloneSuccess ? path.join(baseFolder, repoName) : null,
    mirrorPath: mirrorCloneSuccess ? path.join(baseFolder, `${repoName}-mirror.git`) : null
  };
};

const extractDateParts = async (repoYearMonthDayPath) => {
  const year = path.basename(path.dirname(path.dirname(repoYearMonthDayPath)));
  const month = path.basename(path.dirname(repoYearMonthDayPath));
  const day = path.basename(repoYearMonthDayPath);
  const dateSuffix = `${year}${month}${day}`;

  return { year, month, day, dateSuffix };
};

const extractDatePartsFromDate = (pushedAt) => {
  const updatedAt = new Date(pushedAt);
  const year = updatedAt.getFullYear();
  const month = String(updatedAt.getMonth() + 1).padStart(2, "0");
  const day = String(updatedAt.getDate()).padStart(2, "0");

  return { year, month, day };
};

const createFolderIfNotExist = async (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

const cloneRepoType = async (repoUrl, baseFolder, repoName, isMirror, GITHUB_TOKEN) => {
  try {
    const repoUrl_new = repoUrl.replace("https://", `https://${GITHUB_TOKEN}@`);

    const repoPath = isMirror ? path.join(baseFolder, `${repoName}-mirror.git`) : path.join(baseFolder, repoName);

    if (fs.existsSync(repoPath)) {
      console.log(`🔄 Repo already exists. Checking update method: ${repoPath}`);

      if (isMirror) {
        console.log(`🔄 Fetching mirror updates for ${repoName}`);
        execSync(`git -C "${repoPath}" fetch --all`, { stdio: "inherit" });
      } else {
        console.log(`🔄 Pulling latest changes for ${repoName}`);
        execSync(`git -C "${repoPath}" pull`, { stdio: "inherit" });
      }
    } else {
      const cloneCommand = isMirror ? `git clone --mirror ${repoUrl_new} "${repoPath}"` : `git clone ${repoUrl_new} "${repoPath}"`;

      console.log(`🚀 Cloning ${isMirror ? "Mirror" : "Normal"} -> ${repoName}`);
      try {
        execSync(cloneCommand, { stdio: "inherit" });
      } catch (error) {
        // ถ้าเกิดข้อผิดพลาดให้ลอง clone ใหม่โดยใช้ repoUrl
        console.error(`❌ Clone failed for ${repoName}. Retrying with original URL...`);
        const cloneCommand_clone = isMirror ? `git clone --mirror ${repoUrl} "${repoPath}"` : `git clone ${repoUrl} "${repoPath}"`;
        console.log(`🔄 Retrying clone ${isMirror ? "Mirror" : "Normal"} -> ${repoName}`);

        try {
          execSync(cloneCommand_clone, { stdio: "inherit" });
        } catch (retryError) {
          console.error(`❌ Clone failed for ${repoName} on retry:`, retryError.message);
          return false;
        }
      }
    }

    console.log(`✅ -------------------Success: ${repoName} --------------------`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to clone/update ${repoName}:`, error.message);
    return false;
  }
};

const createZip = async (repoYearMonthDayPath, repoName, zipPath) => {
  execSync(`zip -r "${zipPath}" "${repoName}"`, { stdio: "inherit", cwd: repoYearMonthDayPath });
  console.log(`✅ ZIP Complete -> ${zipPath}`);
};

const cleanupFiles = async (repoPath, zipPath) => {
  fs.rmSync(repoPath, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });
  console.log(`🗑️ Cleaned up: ${repoPath} and ${zipPath}`);
};

const getOrCreateFolder = async (name, parentId, drive) => {
  try {
    const query = `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await drive.files.list({
      q: query,
      fields: "files(id, name)"
    });

    if (Array.isArray(res.data.files) && res.data.files.length > 0) {
      return res.data.files[0].id ?? "";
    }

    const folder = await drive.files.create({
      requestBody: {
        name: name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId]
      },
      fields: "id"
    });

    return folder.data.id ?? "";
  } catch (error) {
    console.error(`❌ Error creating/getting folder ${name}:`, error.message);
    return "";
  }
};

const uploadToGoogleDrive = async (filePath, fileName, year, month, day, driveAccount) => {
  const driveContext = driveConfig.getDriveClient(driveAccount);

  try {
    const yearFolderId = await getOrCreateFolder(year, driveContext.parentFolderId, driveContext.drive);
    const monthFolderId = await getOrCreateFolder(month, yearFolderId, driveContext.drive);
    const dayFolderId = await getOrCreateFolder(day, monthFolderId, driveContext.drive);

    const fileMetadata = {
      name: fileName,
      parents: [dayFolderId]
    };

    const media = {
      mimeType: "application/zip",
      body: fs.createReadStream(filePath)
    };

    const response = await driveContext.drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id"
    });

    console.log(
      `✅ Upload Google Drive successful [${driveContext.label}]: ${fileName} -> ID: (${response.data.id})`
    );

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const formattedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const timestamp = `${formattedDate} ${formattedTime}`;

    const lineMessage = `✅ successfully\n☁️ drive: ${driveContext.label}\n📂 folder: ${year}/${month}/${day}\n📖 file name: ${fileName}\n📦 cloned at: ${timestamp}`;
    await sendLineMessage(lineMessage);
  } catch (error) {
    console.error(`❌ Failed to upload to Google Drive [${driveContext.label}]:`, error.message);
  }
};

const sendLineMessage = async (text) => {
  const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const USER_ID = process.env.LINE_USER_ID;

  if (!CHANNEL_ACCESS_TOKEN || !USER_ID) {
    console.error("❌ LINE Messaging API credentials are missing");
    return;
  }

  const client = new Client({
    channelAccessToken: CHANNEL_ACCESS_TOKEN
  });

  try {
    await client.pushMessage(USER_ID, { type: "text", text });
    console.log("✅ ส่งข้อความผ่าน LINE Messaging API สำเร็จ!");
  } catch (error) {
    console.error("❌ ส่งข้อความผ่าน LINE Messaging API ไม่สำเร็จ:", error.message);
  }
};

cron.schedule(
  process.env.CRON_SCHEDULE,
  async () => {
    console.log("Running cron job...");

    if (backupJobState.isBackupRunning()) {
      console.log("Skipping cron job: another backup is already running");
      return;
    }

    try {
      await GetBackupManual(process.env.GIT_OWNER, process.env.GIT_TOKEN, process.env.GIT_VERSION, {
        driveAccount: driveConfig.DEFAULT_DRIVE_ACCOUNT
      });
    } catch (error) {
      console.error("Error running cron job:", error);
    }
  },
  {
    scheduled: true,
    timezone: "Asia/Bangkok"
  }
);

module.exports = {
  GetBackupManual,
  GetBackupByDateRange,
  PreviewRepositories,
  startBackupNow,
  startBackupByDateRange,
  getBackupJobStatus: backupJobState.getBackupJobStatus
};
