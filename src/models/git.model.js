const https = require("https");
const isEmpty = require("lodash.isempty");
const { execSync } = require("child_process");
const axios = require("axios");
const { Client } = require("@line/bot-sdk");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const { google } = require("googleapis");
const cron = require("node-cron");

dotenv.config();

// const KEY_FILE_PATH = process.env.KEY_FILE_PATH;
const credentials = {
  type: process.env.GG_type,
  project_id: process.env.GG_project_id,
  private_key_id: process.env.GG_private_key_id,
  private_key: process.env.GG_private_key,
  client_email: process.env.GG_client_email,
  client_id: process.env.GG_client_id,
  auth_uri: process.env.GG_auth_uri,
  token_uri: process.env.GG_token_uri,
  auth_provider_x509_cert_url: process.env.GG_auth_provider_x509_cert_url,
  client_x509_cert_url: process.env.GG_client_x509_cert_url,
  universe_domain: process.env.GG_universe_domain
};

const PARENT_FOLDER_ID = process.env.PARENT_FOLDER_ID;
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive.file"]
});

const drive = google.drive({ version: "v3", auth });

const TEMP_FOLDER = path.join(__dirname, "../temp_repos");
if (!fs.existsSync(TEMP_FOLDER)) fs.mkdirSync(TEMP_FOLDER, { recursive: true });

const GetBackupManual = async (owner, GITHUB_TOKEN, GITHUB_API_VERSION) => {
  const repositories = await getRepositories(owner, GITHUB_TOKEN, GITHUB_API_VERSION);
  const responText = "❌ No Repository to clone!";

  if (repositories.length === 0) {
    await sendLineMessage(responText);
    return console.log(responText);
  }

  for (const repo of repositories) {
    const { cloneUrl, pushedAt } = repo;

    const { normalPath, mirrorPath } = await cloneRepo(cloneUrl, pushedAt, GITHUB_TOKEN);
    if (!normalPath && !mirrorPath) continue; // ข้ามถ้าโคลนไม่สำเร็จ
    if (normalPath) await processAndUpload(normalPath, "Normal");
    if (mirrorPath) await processAndUpload(mirrorPath, "Mirror");
  }
};

const processAndUpload = async (repoPath, type) => {
  const repoName = path.basename(repoPath); // Get folder name, e.g., "webhook-mirror"
  const repoYearMonthDayPath = path.dirname(repoPath); // Get repo path, e.g., "temp_repos/2024/02/05"

  const { year, month, day, dateSuffix } = await extractDateParts(repoYearMonthDayPath);
  const zipFileName = `${repoName}-${dateSuffix}.zip`;
  const zipPath = path.join(repoYearMonthDayPath, zipFileName);

  console.log(`📦 Compressing (${type}): ${zipFileName}`);
  await createZip(repoYearMonthDayPath, repoName, zipPath);

  // Upload to Google Drive, organize by year/month/day
  await uploadToGoogleDrive(zipPath, zipFileName, year, month, day);

  // Cleanup: delete files after upload
  await cleanupFiles(repoPath, zipPath);
};

const getRepositories = async (owner, GITHUB_TOKEN, GITHUB_API_VERSION) => {
  let repos = [];
  let page = 1;
  const perPage = 1000;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - parseInt(process.env.DAYS));
  console.log("The repository update period:", sevenDaysAgo);

  try {
    const response = await axios.get(`https://api.github.com/user/repos`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      },
      params: { per_page: perPage, page: page }
    });

    // const ssh_data = response.data.map((repo) => console.log(repo));

    return response.data
      .filter((repo) => new Date(repo.pushed_at) >= sevenDaysAgo)
      .map((repo) => ({
        cloneUrl: repo.clone_url,
        pushedAt: repo.pushed_at
      }));
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
      console.log("cloneCommand>>>>>>>>", cloneCommand);

      console.log(`🚀 Cloning ${isMirror ? "Mirror" : "Normal"} -> ${repoName}`);
      try {
        execSync(cloneCommand, { stdio: "inherit" });
      } catch (error) {
        // ถ้าเกิดข้อผิดพลาดให้ลอง clone ใหม่โดยใช้ repoUrl
        console.error(`❌ Clone failed for ${repoName}. Retrying with original URL...`);
        const cloneCommand_clone = isMirror ? `git clone --mirror ${repoUrl} "${repoPath}"` : `git clone ${repoUrl} "${repoPath}"`;
        console.log("Retrying clone command>>>>>>>>", cloneCommand);

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

const getOrCreateFolder = async (name, parentId = PARENT_FOLDER_ID) => {
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

const uploadToGoogleDrive = async (filePath, fileName, year, month, day) => {
  try {
    const yearFolderId = await getOrCreateFolder(year);
    const monthFolderId = await getOrCreateFolder(month, yearFolderId);
    const dayFolderId = await getOrCreateFolder(day, monthFolderId);

    const fileMetadata = {
      name: fileName,
      parents: [dayFolderId]
    };

    const media = {
      mimeType: "application/zip",
      body: fs.createReadStream(filePath)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id"
    });

    console.log(`✅ Upload Google Drive successful: ${fileName} -> ID: (${response.data.id})`);

    // 🕒 ดึงวันเวลาปัจจุบันและฟอร์แมตเป็น "YYYY-MM-DD HH:mm:ss"
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const formattedTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const timestamp = `${formattedDate} ${formattedTime}`;

    // 🟢 ส่งข้อความผ่าน LINE Messaging API
    const lineMessage = `✅ successfully\n📂 folder: ${year}/${month}/${day}\n📖 file name: ${fileName}\n📦 cloned at: ${timestamp}`;
    await sendLineMessage(lineMessage);
  } catch (error) {
    console.error("❌ Failed to upload to Google Drive:", error.message);
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
  process.env.CRON_SUHEDULE,
  // "*/5 * * * *",
  async () => {
    console.log("Running cron job...");

    try {
      await GetBackupManual(process.env.GIT_OWNER, process.env.GIT_TOKEN, process.env.GIT_VERSION);
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
  GetBackupManual
};
