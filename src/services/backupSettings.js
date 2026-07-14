const fs = require("fs");
const path = require("path");
const driveConfig = require("./driveConfig");
require("dotenv").config();

const SETTINGS_FILE = process.env.BACKUP_SETTINGS_PATH
  || path.join(__dirname, "../../data/backup-settings.json");

const readSettingsFile = () => {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Failed to read backup settings:", error.message);
    return {};
  }
};

const writeSettingsFile = (settings) => {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
};

const resolveConfiguredDestination = (destinationId) => {
  if (!destinationId) return null;
  const parsed = driveConfig.parseDestinationId(destinationId);
  if (!parsed) return null;
  if (!driveConfig.isDriveDestinationConfigured(parsed.destinationId)) return null;
  return parsed.destinationId;
};

const findFirstConfiguredDestination = () => {
  for (const option of driveConfig.getDriveDestinationOptions()) {
    if (option.type === "folder" && option.configured && option.id) {
      return option.id;
    }
  }
  return null;
};

const getFallbackCronDestination = () => {
  const fromEnv = resolveConfiguredDestination(process.env.CRON_DRIVE_DESTINATION);
  if (fromEnv) return fromEnv;

  const defaultAccount = driveConfig.DEFAULT_DRIVE_ACCOUNT;
  const defaultFolders = driveConfig.getParentFolders(defaultAccount);
  if (defaultFolders.length) {
    const destinationId = `${defaultAccount}:${defaultFolders[0].key}`;
    if (driveConfig.isDriveDestinationConfigured(destinationId)) {
      return destinationId;
    }
  }

  return findFirstConfiguredDestination();
};

const getCronDriveDestination = () => {
  const stored = resolveConfiguredDestination(readSettingsFile().cronDriveDestination);
  if (stored) return stored;
  return getFallbackCronDestination();
};

const getCronGitOwner = () => {
  const destinationId = getCronDriveDestination();
  const parsed = driveConfig.parseDestinationId(destinationId);
  if (parsed?.accountKey) {
    return driveConfig.getGitOwner(parsed.accountKey);
  }
  return process.env.GIT_OWNER;
};

const getCronBackupOptions = () => {
  const settings = readSettingsFile();
  const driveDestination = getCronDriveDestination();

  return {
    driveDestination,
    owner: getCronGitOwner(),
    includeNormal: settings.cronIncludeNormal !== false,
    includeMirror: settings.cronIncludeMirror !== false
  };
};

const getCronSettingsView = () => {
  const fileSettings = readSettingsFile();
  const driveDestination = getCronDriveDestination();
  const parsed = driveConfig.parseDestinationId(driveDestination);
  const source = fileSettings.cronDriveDestination && resolveConfiguredDestination(fileSettings.cronDriveDestination)
    ? "dashboard"
    : process.env.CRON_DRIVE_DESTINATION && resolveConfiguredDestination(process.env.CRON_DRIVE_DESTINATION)
      ? "env"
      : "default";

  return {
    driveDestination,
    driveAccountLabel: driveDestination
      ? driveConfig.getDriveDestinationLabel(driveDestination)
      : "ยังไม่ได้ตั้งค่า",
    gitOwner: getCronGitOwner(),
    includeNormal: fileSettings.cronIncludeNormal !== false,
    includeMirror: fileSettings.cronIncludeMirror !== false,
    source,
    configured: Boolean(driveDestination && driveConfig.isDriveDestinationConfigured(driveDestination))
  };
};

const saveCronSettings = (input = {}) => {
  const current = readSettingsFile();
  const next = { ...current };

  if (input.driveDestination !== undefined) {
    const resolved = resolveConfiguredDestination(input.driveDestination);
    if (!resolved) {
      const err = new Error("ปลายทาง Google Drive ที่เลือกไม่พร้อมใช้งาน");
      err.statusCode = 400;
      throw err;
    }
    next.cronDriveDestination = resolved;
  }

  if (input.includeNormal !== undefined) {
    next.cronIncludeNormal = Boolean(input.includeNormal);
  }

  if (input.includeMirror !== undefined) {
    next.cronIncludeMirror = Boolean(input.includeMirror);
  }

  writeSettingsFile(next);
  return getCronSettingsView();
};

module.exports = {
  getCronDriveDestination,
  getCronGitOwner,
  getCronBackupOptions,
  getCronSettingsView,
  saveCronSettings
};
