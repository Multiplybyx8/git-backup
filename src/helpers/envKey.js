/**
 * Resolve env var with optional account suffix.
 * Supports account suffix e.g. GOOGLE_CLIENT_ID_WORASET, GOOGLE_CLIENT_ID_MULTIPLY
 */
const envKey = (base, suffix) => {
  if (!suffix) return process.env[base];

  const keys = [
    `${base}${suffix.toUpperCase()}`,
    `${base}${suffix}`
  ];

  for (const key of keys) {
    if (process.env[key] !== undefined && process.env[key] !== "") {
      return process.env[key];
    }
  }

  return undefined;
};

module.exports = { envKey };
