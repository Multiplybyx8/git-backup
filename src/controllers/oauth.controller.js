const driveConfig = require("../services/driveConfig");
const driveOAuth = require("../services/driveOAuth");

const OAUTH_STATE_COOKIE = "oauth_state";
const VALID_ACCOUNTS = new Set(Object.keys(driveConfig.DRIVE_ACCOUNTS));

const resolveDriveAccountParam = (driveAccount) => {
  if (!driveAccount || !VALID_ACCOUNTS.has(driveAccount)) {
    return { error: "Invalid drive account" };
  }
  if (!driveConfig.isDriveAccountSetup(driveAccount)) {
    return { error: `Drive account "${driveAccount}" is not set up for OAuth` };
  }
  if (driveConfig.getAuthMode(driveAccount) !== "oauth") {
    return { error: `Drive account "${driveAccount}" is not using OAuth mode` };
  }
  return { driveAccount };
};

const oauthConnect = (req, res) => {
  try {
    const driveAccount = req.query.driveAccount || driveConfig.DEFAULT_DRIVE_ACCOUNT;
    const result = resolveDriveAccountParam(driveAccount);
    if (result.error) {
      return res.redirect(`/dashboard?oauth_error=${encodeURIComponent(result.error)}`);
    }

    const { url, state } = driveOAuth.buildAuthUrl(result.driveAccount);

    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 15 * 60 * 1000
    });

    return res.redirect(url);
  } catch (error) {
    console.error("OAuth connect failed:", error);
    return res.redirect(`/dashboard?oauth_error=${encodeURIComponent(error.message)}`);
  }
};

const oauthCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`/dashboard?oauth_error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect("/dashboard?oauth_error=missing_code_or_state");
    }

    if (req.cookies[OAUTH_STATE_COOKIE] !== state) {
      return res.redirect("/dashboard?oauth_error=invalid_oauth_state");
    }

    const parsed = driveOAuth.parseOAuthState(state);
    if (!parsed?.account) {
      return res.redirect("/dashboard?oauth_error=invalid_oauth_state");
    }

    res.clearCookie(OAUTH_STATE_COOKIE);

    await driveOAuth.exchangeCodeForTokens(parsed.account, code);
    driveConfig.invalidateDriveClient(parsed.account);

    return res.redirect(`/dashboard?oauth_success=${encodeURIComponent(parsed.account)}`);
  } catch (err) {
    console.error("OAuth callback failed:", err);
    return res.redirect(`/dashboard?oauth_error=${encodeURIComponent(err.message)}`);
  }
};

const getOAuthStatus = (req, res) => {
  const accounts = driveConfig.getDriveAccountOptions().map((account) => {
    const status = driveOAuth.getOAuthStatus(account.id);
    return {
      id: account.id,
      label: account.label,
      authMode: account.authMode,
      setup: account.setup,
      configured: account.configured,
      oauthConnected: account.oauthConnected,
      oauthEmail: account.oauthEmail,
      oauthConnectedAt: account.oauthConnectedAt,
      refreshToken: account.authMode === "oauth" ? status.refreshToken : null,
      refreshTokenSource: account.authMode === "oauth" ? status.source : null,
      refreshTokenEnvKey: account.authMode === "oauth" ? status.refreshTokenEnvKey : null,
      redirectUri: driveOAuth.getOAuthCredentials(account.id)?.redirectUri || null,
      connectUrl: account.authMode === "oauth" && account.setup && !account.oauthConnected
        ? `/dashboard/oauth/connect?driveAccount=${account.id}`
        : null
    };
  });

  res.json({
    accounts,
    defaultAuthMode: driveConfig.getAuthMode(driveConfig.DEFAULT_DRIVE_ACCOUNT),
    tokenStorePath: "data/oauth-tokens.json"
  });
};

const oauthDisconnect = (req, res) => {
  try {
    const { driveAccount } = req.body;
    const result = resolveDriveAccountParam(driveAccount);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    driveOAuth.clearOAuthToken(result.driveAccount);
    driveConfig.invalidateDriveClient(result.driveAccount);

    const envTokenActive = driveOAuth.isEnvRefreshTokenActive(result.driveAccount);

    res.json({
      message: envTokenActive
        ? `ยกเลิกการเชื่อมต่อแล้ว — มี ${driveOAuth.getRefreshTokenEnvKey(result.driveAccount)} ใน .env แต่แอปจะไม่ใช้จนกว่าจะเชื่อมต่อใหม่`
        : `ยกเลิกการเชื่อมต่อ ${result.driveAccount} แล้ว`,
      envTokenActive,
      envKey: envTokenActive ? driveOAuth.getRefreshTokenEnvKey(result.driveAccount) : null
    });
  } catch (error) {
    console.error("OAuth disconnect failed:", error);
    res.status(500).json({ error: error.message || "Failed to disconnect OAuth" });
  }
};

module.exports = {
  oauthConnect,
  oauthCallback,
  getOAuthStatus,
  oauthDisconnect
};
