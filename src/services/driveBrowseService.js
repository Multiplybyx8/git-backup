const driveConfig = require("./driveConfig");

const DRIVE_LIST_OPTS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true
};

const DRIVE_GET_OPTS = {
  supportsAllDrives: true
};

const pad2 = (value) => String(value).padStart(2, "0");

const parseDateOnly = (value) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const enumerateDates = (dateFrom, dateTo) => {
  const from = parseDateOnly(dateFrom);
  const to = parseDateOnly(dateTo);
  if (!from || !to || from > to) return [];

  const dates = [];
  const cursor = new Date(from);

  while (cursor <= to) {
    dates.push({
      year: String(cursor.getFullYear()),
      month: pad2(cursor.getMonth() + 1),
      day: pad2(cursor.getDate())
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const findFolderId = async (drive, name, parentId) => {
  const query = `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    pageSize: 1,
    ...DRIVE_LIST_OPTS
  });

  return res.data.files?.[0]?.id || null;
};

const resolveDayFolderId = async (drive, rootFolderId, folderPath) => {
  const parts = String(folderPath || "").split("/");
  if (parts.length !== 3) return null;

  const [year, month, day] = parts;
  const yearFolderId = await findFolderId(drive, year, rootFolderId);
  if (!yearFolderId) return null;

  const monthFolderId = await findFolderId(drive, month, yearFolderId);
  if (!monthFolderId) return null;

  return findFolderId(drive, day, monthFolderId);
};

const listZipFiles = async (drive, folderId) => {
  const query = `'${folderId}' in parents and mimeType='application/zip' and trashed=false`;
  const files = [];
  let pageToken;

  do {
    const res = await drive.files.list({
      q: query,
      fields: "nextPageToken, files(id, name, size, createdTime)",
      pageSize: 100,
      pageToken,
      ...DRIVE_LIST_OPTS
    });

    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return files;
};

const verifyFileInBackupFolder = async (drive, fileId, rootFolderId, folderPath) => {
  const dayFolderId = await resolveDayFolderId(drive, rootFolderId, folderPath);
  if (!dayFolderId) return false;

  const dayFiles = await listZipFiles(drive, dayFolderId);
  return dayFiles.some((file) => file.id === fileId);
};

const getDriveFileDownloadStream = async (driveAccount, fileId, folderPath) => {
  if (!driveConfig.isDriveAccountConfigured(driveAccount)) {
    const err = new Error(`Google Drive account "${driveAccount}" is not configured`);
    err.statusCode = 400;
    throw err;
  }

  if (!folderPath) {
    const err = new Error("folderPath is required (YYYY/MM/DD)");
    err.statusCode = 400;
    throw err;
  }

  const driveContext = driveConfig.getDriveClient(driveAccount);
  const { drive, parentFolderId } = driveContext;

  const allowed = await verifyFileInBackupFolder(drive, fileId, parentFolderId, folderPath);
  if (!allowed) {
    const err = new Error("File is not in the backup folder");
    err.statusCode = 403;
    throw err;
  }

  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType",
    ...DRIVE_GET_OPTS
  });

  const response = await drive.files.get(
    { fileId, alt: "media", ...DRIVE_GET_OPTS },
    { responseType: "stream" }
  );

  return {
    stream: response.data,
    name: meta.data.name,
    mimeType: meta.data.mimeType
  };
};

const formatFileSize = (size) => {
  const bytes = Number(size);
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const listDriveBackupsByDateRange = async (driveAccount, dateFrom, dateTo) => {
  if (!driveConfig.isDriveAccountConfigured(driveAccount)) {
    throw new Error(`Google Drive account "${driveAccount}" is not configured`);
  }

  const driveContext = driveConfig.getDriveClient(driveAccount);
  const dates = enumerateDates(dateFrom, dateTo);
  const files = [];

  for (const { year, month, day } of dates) {
    const folderPath = `${year}/${month}/${day}`;
    const yearFolderId = await findFolderId(driveContext.drive, year, driveContext.parentFolderId);
    if (!yearFolderId) continue;

    const monthFolderId = await findFolderId(driveContext.drive, month, yearFolderId);
    if (!monthFolderId) continue;

    const dayFolderId = await findFolderId(driveContext.drive, day, monthFolderId);
    if (!dayFolderId) continue;

    const dayFiles = await listZipFiles(driveContext.drive, dayFolderId);
    dayFiles.forEach((file) => {
      files.push({
        id: file.id,
        name: file.name,
        folderPath,
        createdTime: file.createdTime,
        size: file.size,
        sizeLabel: formatFileSize(file.size)
      });
    });
  }

  files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

  return {
    driveAccount,
    driveAccountLabel: driveConfig.getDriveAccountLabel(driveAccount),
    parentFolderId: driveContext.parentFolderId,
    dateFrom,
    dateTo,
    total: files.length,
    files
  };
};

module.exports = {
  listDriveBackupsByDateRange,
  getDriveFileDownloadStream,
  formatFileSize
};
