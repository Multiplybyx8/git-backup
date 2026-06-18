const { google } = require("googleapis");
require("dotenv").config();

const DRIVE_ACCOUNTS = {
  multiplybyx8: {
    id: "multiplybyx8",
    label: "Multiplybyx8",
    envSuffix: ""
  },
  worasetx8: {
    id: "worasetx8",
    label: "Worasetx8",
    envSuffix: "_dev"
  }
};

const DEFAULT_DRIVE_ACCOUNT = "multiplybyx8";
const driveClients = new Map();

const envKey = (base, suffix) => {
  const key = suffix ? `${base}${suffix}` : base;
  return process.env[key];
};

const buildCredentials = (accountKey) => {
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

const isDriveAccountConfigured = (accountKey) => {
  const credentials = buildCredentials(accountKey);
  if (!credentials) return false;

  return Boolean(
    credentials.project_id &&
      credentials.private_key_id &&
      credentials.private_key &&
      credentials.client_email &&
      credentials.client_id
  );
};

const resolveDriveAccount = (accountKey) => {
  if (accountKey && DRIVE_ACCOUNTS[accountKey] && isDriveAccountConfigured(accountKey)) {
    return accountKey;
  }

  return DEFAULT_DRIVE_ACCOUNT;
};

const getParentFolderId = (accountKey) => {
  if (accountKey === "worasetx8" && process.env.PARENT_FOLDER_ID_DEV) {
    return process.env.PARENT_FOLDER_ID_DEV;
  }

  return process.env.PARENT_FOLDER_ID;
};

const getDriveClient = (accountKey) => {
  const resolved = resolveDriveAccount(accountKey);

  if (!driveClients.has(resolved)) {
    const credentials = buildCredentials(resolved);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"]
    });

    driveClients.set(resolved, {
      drive: google.drive({ version: "v3", auth }),
      accountKey: resolved,
      label: DRIVE_ACCOUNTS[resolved].label,
      parentFolderId: getParentFolderId(resolved),
      clientEmail: credentials.client_email
    });
  }

  return driveClients.get(resolved);
};

const getDriveAccountOptions = () =>
  Object.values(DRIVE_ACCOUNTS).map((account) => ({
    id: account.id,
    label: account.label,
    configured: isDriveAccountConfigured(account.id),
    parentFolderId: getParentFolderId(account.id),
    clientEmail: buildCredentials(account.id)?.client_email || null
  }));

const getDriveAccountLabel = (accountKey) => DRIVE_ACCOUNTS[resolveDriveAccount(accountKey)]?.label || accountKey;

module.exports = {
  DEFAULT_DRIVE_ACCOUNT,
  resolveDriveAccount,
  isDriveAccountConfigured,
  getDriveClient,
  getDriveAccountOptions,
  getDriveAccountLabel,
  getParentFolderId
};
