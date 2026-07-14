const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { google } = require("googleapis");
const { envKey } = require("../helpers/envKey");
require("dotenv").config();

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly"
];
const DRIVE_SCOPE = DRIVE_SCOPES.join(" ");
const TOKEN_FILE = process.env.OAUTH_TOKEN_PATH
  || path.join(__dirname, "../../data/oauth-tokens.json");

const ACCOUNT_SUFFIX = {
  multiplybyx8: "_MULTIPLY",
  worasetx8: "_WORASET",
  platformx8: "_PLATFORM"
};

const getOAuthCredentials = (accountKey) => {
  const suffix = ACCOUNT_SUFFIX[accountKey];
  if (suffix === undefined) return null;

  const clientId = envKey("GOOGLE_CLIENT_ID", suffix);
  const clientSecret = envKey("GOOGLE_CLIENT_SECRET", suffix);
  const redirectUri = envKey("GOOGLE_REDIRECT_URI", suffix) || process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
};

const isOAuthClientConfigured = (accountKey) => Boolean(getOAuthCredentials(accountKey));

const readTokenStore = () => {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return {};
    const raw = fs.readFileSync(TOKEN_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to read OAuth token store:", error.message);
    return {};
  }
};

const writeTokenStore = (store) => {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2), "utf8");
};

const getEnvRefreshToken = (accountKey) => {
  const suffix = ACCOUNT_SUFFIX[accountKey];
  if (suffix === undefined) return null;
  return envKey("GOOGLE_REFRESH_TOKEN", suffix) || null;
};

const isEnvRefreshTokenActive = (accountKey) => Boolean(getEnvRefreshToken(accountKey));

const isExplicitlyDisconnected = (accountKey) => Boolean(readTokenStore()[accountKey]?.disconnected);

const getStoredToken = (accountKey) => {
  const fromFile = readTokenStore()[accountKey];

  if (fromFile?.disconnected && !fromFile?.refresh_token) {
    return null;
  }

  if (fromFile?.refresh_token) return fromFile;

  if (fromFile?.disconnected) {
    return null;
  }

  const fromEnv = getEnvRefreshToken(accountKey);
  if (fromEnv) {
    return {
      refresh_token: fromEnv,
      email: null,
      connected_at: null,
      source: "env"
    };
  }

  return null;
};

const isOAuthConnected = (accountKey) => {
  if (isExplicitlyDisconnected(accountKey)) return false;
  return Boolean(getStoredToken(accountKey)?.refresh_token);
};

const saveOAuthToken = (accountKey, tokens, email = null) => {
  const store = readTokenStore();
  store[accountKey] = {
    refresh_token: tokens.refresh_token || store[accountKey]?.refresh_token,
    access_token: tokens.access_token || null,
    expiry_date: tokens.expiry_date || null,
    email: email || store[accountKey]?.email || null,
    connected_at: new Date().toISOString(),
    source: "oauth",
    disconnected: false
  };
  writeTokenStore(store);
  return store[accountKey];
};

const clearOAuthToken = (accountKey) => {
  const store = readTokenStore();
  store[accountKey] = {
    disconnected: true,
    disconnected_at: new Date().toISOString()
  };
  writeTokenStore(store);
};

const createOAuth2Client = (accountKey) => {
  const creds = getOAuthCredentials(accountKey);
  if (!creds) return null;

  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
};

const getOAuth2Client = async (accountKey) => {
  const oauth2Client = createOAuth2Client(accountKey);
  if (!oauth2Client) {
    throw new Error(`OAuth client not configured for "${accountKey}"`);
  }

  const stored = getStoredToken(accountKey);
  if (!stored?.refresh_token) {
    throw new Error(`Google Drive OAuth not connected for "${accountKey}"`);
  }

  oauth2Client.setCredentials({
    refresh_token: stored.refresh_token,
    access_token: stored.access_token || undefined,
    expiry_date: stored.expiry_date || undefined
  });

  oauth2Client.on("tokens", (tokens) => {
    if (tokens.refresh_token || tokens.access_token) {
      saveOAuthToken(accountKey, tokens);
    }
  });

  return oauth2Client;
};

const buildAuthUrl = (accountKey) => {
  const oauth2Client = createOAuth2Client(accountKey);
  if (!oauth2Client) {
    throw new Error(`OAuth client not configured for "${accountKey}"`);
  }

  const state = Buffer.from(JSON.stringify({
    account: accountKey,
    nonce: crypto.randomBytes(16).toString("hex"),
    ts: Date.now()
  })).toString("base64url");

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: DRIVE_SCOPES,
    state,
    include_granted_scopes: true
  });

  return { url, state };
};

const parseOAuthState = (state) => {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    if (!parsed.account || !parsed.nonce) return null;
    if (Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
};

const exchangeCodeForTokens = async (accountKey, code) => {
  const oauth2Client = createOAuth2Client(accountKey);
  if (!oauth2Client) {
    throw new Error(`OAuth client not configured for "${accountKey}"`);
  }

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh_token received — revoke app access and connect again with prompt=consent");
  }

  oauth2Client.setCredentials(tokens);

  let email = null;
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const profile = await oauth2.userinfo.get();
    email = profile.data.email || null;
  } catch (error) {
    console.warn("Could not fetch OAuth user email:", error.message);
  }

  const saved = saveOAuthToken(accountKey, tokens, email);
  return saved;
};

const getRefreshTokenEnvKey = (accountKey) => {
  const suffix = ACCOUNT_SUFFIX[accountKey];
  if (suffix === undefined) return null;
  return suffix ? `GOOGLE_REFRESH_TOKEN${suffix.toUpperCase()}` : "GOOGLE_REFRESH_TOKEN";
};

const getOAuthStatus = (accountKey) => {
  const stored = getStoredToken(accountKey);
  return {
    clientConfigured: isOAuthClientConfigured(accountKey),
    connected: Boolean(stored?.refresh_token),
    email: stored?.email || null,
    connectedAt: stored?.connected_at || null,
    source: stored?.source || null,
    refreshToken: stored?.refresh_token || null,
    refreshTokenEnvKey: getRefreshTokenEnvKey(accountKey)
  };
};

module.exports = {
  DRIVE_SCOPE,
  DRIVE_SCOPES,
  TOKEN_FILE,
  getOAuthCredentials,
  isOAuthClientConfigured,
  isOAuthConnected,
  getStoredToken,
  saveOAuthToken,
  clearOAuthToken,
  createOAuth2Client,
  getOAuth2Client,
  buildAuthUrl,
  parseOAuthState,
  exchangeCodeForTokens,
  getOAuthStatus,
  getRefreshTokenEnvKey,
  getEnvRefreshToken,
  isEnvRefreshTokenActive,
  isExplicitlyDisconnected
};
