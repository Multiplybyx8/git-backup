const backupJobState = {
  running: false,
  type: null,
  startedAt: null,
  currentRepo: null,
  lastResult: null
};

let backupLock = false;

const isBackupRunning = () => backupLock;

const acquireBackupLock = (type) => {
  if (backupLock) return false;

  backupLock = true;
  backupJobState.running = true;
  backupJobState.type = type;
  backupJobState.startedAt = new Date().toISOString();
  backupJobState.currentRepo = null;
  return true;
};

const releaseBackupLock = (result) => {
  backupLock = false;
  backupJobState.running = false;
  backupJobState.currentRepo = null;

  if (result) {
    backupJobState.lastResult = {
      ...result,
      finishedAt: new Date().toISOString(),
      type: backupJobState.type
    };
  }
};

const setCurrentRepo = (repoName) => {
  backupJobState.currentRepo = repoName;
};

const getBackupJobStatus = () => ({ ...backupJobState });

module.exports = {
  isBackupRunning,
  acquireBackupLock,
  releaseBackupLock,
  setCurrentRepo,
  getBackupJobStatus
};
