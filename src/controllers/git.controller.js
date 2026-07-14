const gitModel = require("../models/git.model");

const BackupManual = async (req, res, next) => {
  try {
    const owner = process.env.GIT_OWNER;
    const GITHUB_TOKEN = process.env.GIT_TOKEN;
    const GITHUB_API_VERSION = process.env.GIT_VERSION;

    if (!owner) {
      throw new Error("GIT_OWNER is required");
    }

    const resultData = await gitModel.GetBackupManual(owner, GITHUB_TOKEN, GITHUB_API_VERSION);
    res.send(resultData);
  } catch (error) {
    res.status(500).send({ error: "An unknown error occurred" });
  }
};

module.exports = {
  BackupManual
};
