const isEmpty = require("lodash.isempty");
const dotenv = require("dotenv");
const gitModel = require("../models/git.model");

dotenv.config();

const BackupManual = async (req, res, next) => {
  try {
    const { owner } = req.query;
    const GITHUB_TOKEN = process.env.GIT_TOKEN;
    const GITHUB_API_VERSION = process.env.GIT_VERSION;

    if (!req.query.owner) {
      throw new Error("Owner are required");
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
