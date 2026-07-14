const driveConfig = require("./driveConfig");

const DRIVE_LIST_OPTS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true
};

const DRIVE_GET_OPTS = {
  supportsAllDrives: true
};

const ZIP_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed"
];

const pad2 = (value) => String(value).padStart(2, "0");

const FOLDER_MIME = "application/vnd.google-apps.folder";

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

const endOfDateOnly = (value) => {
  const date = parseDateOnly(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const isCreatedInDateRange = (createdTime, dateFrom, dateTo) => {
  const created = new Date(createdTime);
  const from = parseDateOnly(dateFrom);
  const to = endOfDateOnly(dateTo);
  if (!from || !to || Number.isNaN(created.getTime())) return false;
  return created >= from && created <= to;
};

const listFolderChildren = async (drive, folderId) => {
  const items = [];
  let pageToken;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken, files(id, name, mimeType, size, createdTime, webViewLink)",
      pageSize: 100,
      pageToken,
      ...DRIVE_LIST_OPTS
    });

    items.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return items;
};

const isFileUnderFolder = async (drive, fileId, rootFolderId) => {
  let currentId = fileId;

  while (currentId) {
    if (currentId === rootFolderId) return true;

    const res = await drive.files.get({
      fileId: currentId,
      fields: "id, parents",
      ...DRIVE_GET_OPTS
    });

    const parents = res.data.parents || [];
    if (parents.length === 0) return false;
    if (parents.includes(rootFolderId)) return true;
    currentId = parents[0];
  }

  return false;
};

const folderNameVariants = (value) => {
  const text = String(value);
  const variants = [text];
  const unpadded = String(Number(text));
  if (unpadded !== text && unpadded !== "NaN") variants.push(unpadded);
  const padded = pad2(text);
  if (padded !== text) variants.push(padded);
  return [...new Set(variants)];
};

const findFolderId = async (drive, name, parentId) => {
  const escaped = String(name).replace(/'/g, "\\'");
  const query = `'${parentId}' in parents and name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    pageSize: 1,
    ...DRIVE_LIST_OPTS
  });

  return res.data.files?.[0]?.id || null;
};

const findFolderIdByVariants = async (drive, names, parentId) => {
  for (const name of names) {
    const folderId = await findFolderId(drive, name, parentId);
    if (folderId) return folderId;
  }
  return null;
};

const resolveDayFolderId = async (drive, rootFolderId, folderPath) => {
  const parts = String(folderPath || "").split("/");
  if (parts.length !== 3) return null;

  const [year, month, day] = parts;
  const yearFolderId = await findFolderIdByVariants(drive, folderNameVariants(year), rootFolderId);
  if (!yearFolderId) return null;

  const monthFolderId = await findFolderIdByVariants(drive, folderNameVariants(month), yearFolderId);
  if (!monthFolderId) return null;

  return findFolderIdByVariants(drive, folderNameVariants(day), monthFolderId);
};

const listZipFiles = async (drive, folderId) => {
  const mimeQuery = ZIP_MIME_TYPES.map((type) => `mimeType='${type}'`).join(" or ");
  const query = `'${folderId}' in parents and (${mimeQuery}) and trashed=false`;
  const files = [];
  let pageToken;

  do {
    const res = await drive.files.list({
      q: query,
      fields: "nextPageToken, files(id, name, size, createdTime, mimeType)",
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

const getDriveFileDownloadStream = async (driveDestination, fileId, folderPath, options = {}) => {
  const destination = driveConfig.resolveDriveDestination(driveDestination);
  if (!destination || !driveConfig.isDriveDestinationConfigured(destination.destinationId)) {
    const err = new Error(`Google Drive destination "${driveDestination}" is not configured`);
    err.statusCode = 400;
    throw err;
  }

  const driveContext = await driveConfig.getDriveClient(destination.destinationId);
  const { drive, parentFolderId } = driveContext;

  let allowed = false;
  if (options.verifyParent) {
    allowed = await isFileUnderFolder(drive, fileId, parentFolderId);
  } else {
    if (!folderPath) {
      const err = new Error("folderPath is required (YYYY/MM/DD)");
      err.statusCode = 400;
      throw err;
    }
    allowed = await verifyFileInBackupFolder(drive, fileId, parentFolderId, folderPath);
  }

  if (!allowed) {
    const err = new Error("File is not in the selected folder");
    err.statusCode = 403;
    throw err;
  }

  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType",
    ...DRIVE_GET_OPTS
  });

  if (meta.data.mimeType === FOLDER_MIME) {
    const err = new Error("Cannot download a folder");
    err.statusCode = 400;
    throw err;
  }

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

const listDriveBackupsByDateRange = async (driveDestination, dateFrom, dateTo) => {
  const destination = driveConfig.resolveDriveDestination(driveDestination);
  if (!destination || !driveConfig.isDriveDestinationConfigured(destination.destinationId)) {
    throw new Error(`Google Drive destination "${driveDestination}" is not configured`);
  }

  const driveContext = await driveConfig.getDriveClient(destination.destinationId);
  const dates = enumerateDates(dateFrom, dateTo);
  const files = [];
  let dayFoldersFound = 0;

  for (const { year, month, day } of dates) {
    const folderPath = `${year}/${month}/${day}`;
    const yearFolderId = await findFolderIdByVariants(
      driveContext.drive,
      folderNameVariants(year),
      driveContext.parentFolderId
    );
    if (!yearFolderId) continue;

    const monthFolderId = await findFolderIdByVariants(
      driveContext.drive,
      folderNameVariants(month),
      yearFolderId
    );
    if (!monthFolderId) continue;

    const dayFolderId = await findFolderIdByVariants(
      driveContext.drive,
      folderNameVariants(day),
      monthFolderId
    );
    if (!dayFolderId) continue;

    dayFoldersFound += 1;
    const dayFiles = await listZipFiles(driveContext.drive, dayFolderId);
    dayFiles.forEach((file) => {
      files.push({
        id: file.id,
        name: file.name,
        folderPath,
        createdTime: file.createdTime,
        size: file.size,
        sizeLabel: formatFileSize(file.size),
        mimeType: file.mimeType
      });
    });
  }

  files.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

  return {
    driveDestination: destination.destinationId,
    driveAccount: destination.accountKey,
    driveAccountLabel: driveConfig.getDriveDestinationLabel(destination.destinationId),
    parentFolderId: driveContext.parentFolderId,
    dateFrom,
    dateTo,
    total: files.length,
    files,
    scan: {
      datesChecked: dates.length,
      dayFoldersFound,
      fileTypes: ZIP_MIME_TYPES,
      structure: "ปี/เดือน/วัน ภายใต้ Folder ที่เลือก"
    }
  };
};

const listDriveItemsByCreateDate = async (driveDestination, dateFrom, dateTo) => {
  const destination = driveConfig.resolveDriveDestination(driveDestination);
  if (!destination || !driveConfig.isDriveDestinationConfigured(destination.destinationId)) {
    throw new Error(`Google Drive destination "${driveDestination}" is not configured`);
  }

  const driveContext = await driveConfig.getDriveClient(destination.destinationId);
  const { drive, parentFolderId } = driveContext;
  const items = [];
  const queue = [{ folderId: parentFolderId, path: "" }];
  let foldersScanned = 0;
  let itemsChecked = 0;

  while (queue.length) {
    const { folderId, path } = queue.shift();
    foldersScanned += 1;
    const children = await listFolderChildren(drive, folderId);

    for (const child of children) {
      itemsChecked += 1;
      const isFolder = child.mimeType === FOLDER_MIME;
      const childPath = path ? `${path}/${child.name}` : child.name;

      if (isCreatedInDateRange(child.createdTime, dateFrom, dateTo)) {
        items.push({
          id: child.id,
          name: child.name,
          path: childPath,
          mimeType: child.mimeType,
          isFolder,
          createdTime: child.createdTime,
          size: child.size,
          sizeLabel: isFolder ? "—" : formatFileSize(child.size),
          webViewLink: child.webViewLink || null
        });
      }

      if (isFolder) {
        queue.push({ folderId: child.id, path: childPath });
      }
    }
  }

  items.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

  const folderCount = items.filter((item) => item.isFolder).length;
  const fileCount = items.length - folderCount;

  return {
    driveDestination: destination.destinationId,
    driveAccount: destination.accountKey,
    driveAccountLabel: driveConfig.getDriveDestinationLabel(destination.destinationId),
    parentFolderId,
    dateFrom,
    dateTo,
    total: items.length,
    folderCount,
    fileCount,
    items,
    scan: {
      foldersScanned,
      itemsChecked,
      filter: "createdTime",
      structure: "ทุกโฟลเดอร์และไฟล์ภายใต้ Folder ที่เลือก"
    }
  };
};

module.exports = {
  listDriveBackupsByDateRange,
  listDriveItemsByCreateDate,
  getDriveFileDownloadStream,
  formatFileSize
};
