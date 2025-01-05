const CryptoHelper = require("./cryptoHelper");
const FilesHelper = require("./filesHelper");
const { CERT_DIR } = require("./constants");
const { CertificationManager } = require("./certificates");

const logMessage = (node, msg) => console.log(`[${node}] ${msg}`);

class Node {
  constructor(identifier, portNumber) {
    this.nodeName = identifier;
    this.nodePort = portNumber;
  }

  async initializeNode() {
    const serverCertPath = FilesHelper.joinPaths(
      CERT_DIR,
      `${this.nodeName}-cert.pem`
    );
    const serverKeyPath = FilesHelper.joinPaths(
      CERT_DIR,
      `${this.nodeName}-key.pem`
    );

    const caCertPath = FilesHelper.joinPaths(CERT_DIR, "ca-cert.pem");

    if (
      !(await FilesHelper.fileExists(serverCertPath)) ||
      !(await FilesHelper.fileExists(serverKeyPath))
    ) {
      logMessage(this.nodeName, "Generating certificates...");
      await CertificationManager.createServerCertificate(this.nodeName);
    }

    this.serverCert = JSON.parse(
      await FilesHelper.readFromFile(serverCertPath)
    );
    this.serverKey = await FilesHelper.readFromFile(serverKeyPath);
    logMessage(this.nodeName, "Server certificate and key loaded.");

    this.caCert = JSON.parse(await FilesHelper.readFromFile(caCertPath));
    logMessage(this.nodeName, "CA certificate loaded.");

    logMessage(this.nodeName, "Initialization completed.");
  }
}

module.exports = Node;
