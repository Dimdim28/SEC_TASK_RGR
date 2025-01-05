const FilesHelper = require("./filesHelper");

const CERT_DIR = "./certs";
const CA_CERT_PATH = FilesHelper.joinPaths(CERT_DIR, "ca-cert.pem");
const CA_KEY_PATH = FilesHelper.joinPaths(CERT_DIR, "ca-key.pem");

module.exports = {
  CERT_DIR,
  CA_CERT_PATH,
  CA_KEY_PATH,
};
