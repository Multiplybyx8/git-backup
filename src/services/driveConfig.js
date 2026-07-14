const { google } = require("googleapis");
const driveOAuth = require("./driveOAuth");
const { envKey } = require("../helpers/envKey");
require("dotenv").config();

const DRIVE_ACCOUNTS = {
  multiplybyx8: {
    id: "multiplybyx8",
    label: "Multiplybyx8",
    envSuffix: "_MULTIPLY"
  },
  worasetx8: {
    id: "worasetx8",
    label: "Worasetx8",
    envSuffix: "_WORASET"
  },
  platformx8: {
    id: "platformx8",
    label: "Platformx8",
    envSuffix: "_PLATFORM"
  }
};

const DEFAULT_DRIVE_ACCOUNT = "multiplybyx8";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const MAX_PARENT_FOLDERS = 20;
const driveClients = new Map();

const getParentFolderEnvValue = (accountKey) => {
  const account = DRIVE_ACCOUNTS[accountKey];
  if (!account) return null;

  return (
    envKey("PARENT_FOLDERS", account.envSuffix) ||
    envKey("PARENT_FOLDER_ID", account.envSuffix) ||
    null
  );
};

const parseParentFolderEntry = (entry, index) => {
  if (typeof entry === "string" && entry.trim()) {
    return {
      key: String(index + 1),
      folderId: entry.trim(),
      label: `โฟลเดอร์ ${index + 1}`
    };
  }

  if (entry && typeof entry === "object") {
    const folderId = entry.id || entry.folderId || entry.folder_id;
    if (!folderId) return null;

    return {
      key: String(index + 1),
      folderId: String(folderId).trim(),
      label: entry.label || entry.name || `โฟลเดอร์ ${index + 1}`
    };
  }

  return null;
};

const parseParentFolderArrayEnv = (raw) => {
  if (!raw) return [];

  const trimmed = String(raw).trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((entry, index) => parseParentFolderEntry(entry, index))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  return [{
    key: "default",
    folderId: trimmed,
    label: "หลัก"
  }];
};

const getEnvTag = (envSuffix) => envSuffix.replace(/^_/, "").toUpperCase();

const getParentFolderEnvKeys = (accountKey, index) => {
  const account = DRIVE_ACCOUNTS[accountKey];
  if (!account) return { folderKey: null, labelKey: null };

  const tag = getEnvTag(account.envSuffix);
  return {
    folderKey: `PARENT_FOLDER_ID_${tag}_${index}`,
    labelKey: `PARENT_FOLDER_LABEL_${tag}_${index}`
  };
};

const getParentFoldersFromNumberedEnv = (accountKey) => {
  const folders = [];

  for (let i = 1; i <= MAX_PARENT_FOLDERS; i += 1) {
    const { folderKey, labelKey } = getParentFolderEnvKeys(accountKey, i);
    const folderId = process.env[folderKey];
    if (!folderId) continue;

    const customLabel = process.env[labelKey];
    folders.push({
      key: String(i),
      folderId,
      label: customLabel || `โฟลเดอร์ ${i}`
    });
  }

  return folders;
};

const getParentFolders = (accountKey) => {
  if (!DRIVE_ACCOUNTS[accountKey]) return [];

  const fromArray = parseParentFolderArrayEnv(getParentFolderEnvValue(accountKey));
  if (fromArray.length) return fromArray;

  return getParentFoldersFromNumberedEnv(accountKey);
};

const getDefaultAuthMode = () => (process.env.DRIVE_AUTH_MODE || "service_account").toLowerCase();

const getAuthMode = (accountKey) => {
  const account = DRIVE_ACCOUNTS[accountKey];
  if (!account) return getDefaultAuthMode();

  const perAccount = envKey("DRIVE_AUTH_MODE", account.envSuffix);
  if (perAccount) return perAccount.toLowerCase();

  if (driveOAuth.isOAuthClientConfigured(accountKey)) {
    return "oauth";
  }

  return getDefaultAuthMode();
};

const buildServiceAccountCredentials = (accountKey) => {
  const account = DRIVE_ACCOUNTS[accountKey];
  if (!account) return null;

  const suffix = account.envSuffix;

  return {
    type: process.env.GG_type,
    project_id: envKey("GG_project_id", suffix),
    private_key_id: envKey("GG_private_key_id", suffix),
    private_key: envKey("GG_private_key", suffix),
    client_email: envKey("GG_client_email", suffix),
    client_id: envKey("GG_client_id", suffix),
    auth_uri: process.env.GG_auth_uri,
    token_uri: process.env.GG_token_uri,
    auth_provider_x509_cert_url: envKey("GG_auth_provider_x509_cert_url", suffix),
    client_x509_cert_url: envKey("GG_client_x509_cert_url", suffix),
    universe_domain: process.env.GG_universe_domain
  };
};

const isServiceAccountConfigured = (accountKey) => {
  const credentials = buildServiceAccountCredentials(accountKey);
  if (!credentials) return false;

  return Boolean(
    credentials.project_id &&
      credentials.private_key_id &&
      credentials.private_key &&
      credentials.client_email &&
      credentials.client_id
  );
};

const buildDestinationId = (accountKey, folderKey) => `${accountKey}:${folderKey}`;

const parseDestinationId = (destinationId) => {
  if (!destinationId) return null;

  const colonIndex = destinationId.indexOf(":");
  if (colonIndex === -1) {
    const accountKey = destinationId;
    if (!DRIVE_ACCOUNTS[accountKey]) return null;

    const folders = getParentFolders(accountKey);
    if (!folders.length) return null;

    const folder = folders[0];
    return {
      accountKey,
      folderKey: folder.key,
      parentFolderId: folder.folderId,
      folderLabel: folder.label,
      destinationId: buildDestinationId(accountKey, folder.key)
    };
  }

  const accountKey = destinationId.slice(0, colonIndex);
  const folderKey = destinationId.slice(colonIndex + 1);
  if (!DRIVE_ACCOUNTS[accountKey]) return null;

  const folder = getParentFolders(accountKey).find((item) => item.key === folderKey);
  if (!folder) return null;

  return {
    accountKey,
    folderKey: folder.key,
    parentFolderId: folder.folderId,
    folderLabel: folder.label,
    destinationId
  };
};

const resolveDriveDestination = (destinationId) => {
  const parsed = parseDestinationId(destinationId);
  if (!parsed) return null;

  if (isDriveDestinationConfigured(parsed.destinationId)) {
    return parsed;
  }

  if (isDriveDestinationConfigured(buildDestinationId(DEFAULT_DRIVE_ACCOUNT, "default"))) {
    const fallback = parseDestinationId(DEFAULT_DRIVE_ACCOUNT);
    if (fallback && isDriveDestinationConfigured(fallback.destinationId)) {
      return fallback;
    }
  }

  const defaultFolders = getParentFolders(DEFAULT_DRIVE_ACCOUNT);
  if (defaultFolders.length && isDriveAccountConfigured(DEFAULT_DRIVE_ACCOUNT)) {
    const folder = defaultFolders[0];
    return {
      accountKey: DEFAULT_DRIVE_ACCOUNT,
      folderKey: folder.key,
      parentFolderId: folder.folderId,
      folderLabel: folder.label,
      destinationId: buildDestinationId(DEFAULT_DRIVE_ACCOUNT, folder.key)
    };
  }

  return parsed;
};

const hasParentFolder = (accountKey) => getParentFolders(accountKey).length > 0;

const isDriveAccountConfigured = (accountKey) => {
  if (!DRIVE_ACCOUNTS[accountKey] || !hasParentFolder(accountKey)) return false;

  const mode = getAuthMode(accountKey);
  if (mode === "oauth") {
    return driveOAuth.isOAuthClientConfigured(accountKey) && driveOAuth.isOAuthConnected(accountKey);
  }

  return isServiceAccountConfigured(accountKey);
};

const isDriveAccountSetup = (accountKey) => {
  if (!DRIVE_ACCOUNTS[accountKey]) return false;

  const mode = getAuthMode(accountKey);
  if (mode === "oauth") {
    return driveOAuth.isOAuthClientConfigured(accountKey);
  }

  return isServiceAccountConfigured(accountKey);
};

const isDriveDestinationConfigured = (destinationId) => {
  const parsed = parseDestinationId(destinationId);
  if (!parsed) return false;
  return isDriveAccountConfigured(parsed.accountKey);
};

const resolveDriveAccount = (accountKey) => {
  const parsed = parseDestinationId(accountKey);
  if (parsed) return parsed.accountKey;

  if (accountKey && DRIVE_ACCOUNTS[accountKey] && isDriveAccountConfigured(accountKey)) {
    return accountKey;
  }

  if (isDriveAccountConfigured(DEFAULT_DRIVE_ACCOUNT)) {
    return DEFAULT_DRIVE_ACCOUNT;
  }

  return accountKey && DRIVE_ACCOUNTS[accountKey] ? accountKey : DEFAULT_DRIVE_ACCOUNT;
};

const getParentFolderId = (accountKey) => getParentFolders(accountKey)[0]?.folderId || null;

const getDriveClientCacheKey = (accountKey, folderKey) => `${accountKey}:${folderKey || "default"}`;

const invalidateDriveClient = (accountKey) => {
  for (const key of [...driveClients.keys()]) {
    if (key === accountKey || key.startsWith(`${accountKey}:`)) {
      driveClients.delete(key);
    }
  }
};

const buildServiceAccountClient = async (accountKey, parentFolderId, folderKey) => {
  const credentials = buildServiceAccountCredentials(accountKey);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [DRIVE_SCOPE]
  });

  return {
    drive: google.drive({ version: "v3", auth }),
    accountKey,
    folderKey,
    label: DRIVE_ACCOUNTS[accountKey].label,
    parentFolderId,
    clientEmail: credentials.client_email,
    authMode: "service_account"
  };
};

const buildOAuthClient = async (accountKey, parentFolderId, folderKey) => {
  const auth = await driveOAuth.getOAuth2Client(accountKey);
  const status = driveOAuth.getOAuthStatus(accountKey);

  return {
    drive: google.drive({ version: "v3", auth }),
    accountKey,
    folderKey,
    label: DRIVE_ACCOUNTS[accountKey].label,
    parentFolderId,
    clientEmail: status.email || "OAuth (Gmail)",
    authMode: "oauth"
  };
};

const getDriveClient = async (destinationRef, options = {}) => {
  const parsed = typeof destinationRef === "string"
    ? parseDestinationId(destinationRef)
    : null;

  const accountKey = parsed?.accountKey || destinationRef;
  const folderKey = options.folderKey || parsed?.folderKey || getParentFolders(accountKey)[0]?.key;
  const parentFolderId = options.parentFolderId || parsed?.parentFolderId || getParentFolders(accountKey).find((item) => item.key === folderKey)?.folderId;

  const resolvedAccount = resolveDriveAccount(accountKey);
  const mode = getAuthMode(resolvedAccount);

  if (!isDriveAccountConfigured(resolvedAccount)) {
    if (mode === "oauth") {
      throw new Error(`Google Drive OAuth not connected for "${resolvedAccount}" — connect via Dashboard`);
    }
    throw new Error(`Google Drive account "${resolvedAccount}" is not configured`);
  }

  if (!parentFolderId) {
    throw new Error(`Parent folder is not configured for "${resolvedAccount}"`);
  }

  const cacheKey = getDriveClientCacheKey(resolvedAccount, folderKey);
  if (!driveClients.has(cacheKey)) {
    const client = mode === "oauth"
      ? await buildOAuthClient(resolvedAccount, parentFolderId, folderKey)
      : await buildServiceAccountClient(resolvedAccount, parentFolderId, folderKey);

    driveClients.set(cacheKey, client);
  }

  return driveClients.get(cacheKey);
};

const buildAccountMeta = (accountKey) => {
  const mode = getAuthMode(accountKey);
  const oauthStatus = driveOAuth.getOAuthStatus(accountKey);
  const ready = isDriveAccountConfigured(accountKey);
  const setup = isDriveAccountSetup(accountKey);
  const oauthActive = mode === "oauth";
  const oauthCreds = oauthActive ? driveOAuth.getOAuthCredentials(accountKey) : null;

  let clientEmail = null;
  if (oauthActive) {
    clientEmail = oauthStatus.connected
      ? (oauthStatus.email || "OAuth connected")
      : "OAuth — ยังไม่เชื่อมต่อ";
  } else {
    clientEmail = buildServiceAccountCredentials(accountKey)?.client_email || null;
  }

  return {
    id: accountKey,
    label: DRIVE_ACCOUNTS[accountKey].label,
    authMode: mode,
    configured: ready,
    setup,
    oauthConnected: oauthActive && oauthStatus.connected,
    oauthEmail: oauthActive ? oauthStatus.email : null,
    oauthConnectedAt: oauthActive ? oauthStatus.connectedAt : null,
    redirectUri: oauthCreds?.redirectUri || null,
    refreshTokenEnvKey: oauthActive ? driveOAuth.getRefreshTokenEnvKey(accountKey) : null,
    clientEmail
  };
};

const getDriveAccountOptions = () =>
  Object.keys(DRIVE_ACCOUNTS).map((accountKey) => {
    const folders = getParentFolders(accountKey);

    return {
      ...buildAccountMeta(accountKey),
      parentFolderId: getParentFolderId(accountKey),
      folders: folders.map((folder) => ({
        key: folder.key,
        label: folder.label,
        folderId: folder.folderId,
        destinationId: buildDestinationId(accountKey, folder.key)
      }))
    };
  });

const getDriveDestinationOptions = () => {
  const destinations = [];

  Object.keys(DRIVE_ACCOUNTS).forEach((accountKey) => {
    const account = buildAccountMeta(accountKey);
    const folders = getParentFolders(accountKey);

    if (account.authMode === "oauth" && account.setup && !account.oauthConnected) {
      destinations.push({
        type: "oauth_pending",
        ...account
      });
      return;
    }

    if (!folders.length) {
      destinations.push({
        ...account,
        type: "folder",
        id: buildDestinationId(accountKey, "default"),
        accountId: accountKey,
        folderKey: "default",
        folderLabel: "หลัก",
        displayLabel: account.label,
        parentFolderId: null,
        configured: false
      });
      return;
    }

    folders.forEach((folder) => {
      const displayLabel = folders.length > 1
        ? `${account.label} · ${folder.label}`
        : account.label;

      destinations.push({
        ...account,
        type: "folder",
        id: buildDestinationId(accountKey, folder.key),
        accountId: accountKey,
        folderKey: folder.key,
        folderLabel: folder.label,
        displayLabel,
        parentFolderId: folder.folderId,
        configured: account.configured
      });
    });
  });

  return destinations;
};

const getDriveAccountLabel = (accountKey) => DRIVE_ACCOUNTS[resolveDriveAccount(accountKey)]?.label || accountKey;

const getDriveDestinationLabel = (destinationId) => {
  const parsed = parseDestinationId(destinationId);
  if (!parsed) return destinationId;

  const accountLabel = getDriveAccountLabel(parsed.accountKey);
  const folders = getParentFolders(parsed.accountKey);
  if (folders.length <= 1) return accountLabel;

  return `${accountLabel} · ${parsed.folderLabel}`;
};

module.exports = {
  DRIVE_ACCOUNTS,
  DEFAULT_DRIVE_ACCOUNT,
  getAuthMode,
  resolveDriveAccount,
  resolveDriveDestination,
  parseDestinationId,
  isDriveAccountConfigured,
  isDriveAccountSetup,
  isDriveDestinationConfigured,
  isServiceAccountConfigured,
  getDriveClient,
  invalidateDriveClient,
  getDriveAccountOptions,
  getDriveDestinationOptions,
  getDriveAccountLabel,
  getDriveDestinationLabel,
  getParentFolderId,
  getParentFolders
};
