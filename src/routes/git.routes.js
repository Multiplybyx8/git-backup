const express = require("express");
const router = express.Router();
require("dotenv").config();
const gitController = require("../controllers/git.controller");

router.get("/manual", gitController.BackupManual);

module.exports = router;
