const net = require("net");
const CryptoHelper = require("./cryptoHelper");
const FilesHelper = require("./filesHelper");
const { CERT_DIR } = require("./constants");
const { CertificationManager } = require("./certificates");

const logMessage = (node, msg) => console.log(`[${node}] ${msg}`);

class Node {
  constructor(identifier, portNumber) {
    this.nodeName = identifier;
    this.nodePort = portNumber;
    this.randomServerValue = CryptoHelper.createRandomString();
    this.activeClientConnections = [];
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

  async launchServer() {
    return new Promise((resolve) => {
      const serverInstance = net.createServer((socket) => {
        logMessage(this.nodeName, "Incoming client connection established.");

        let sessionKey;

        socket.on("data", async (incoming) => {
          const payload = JSON.parse(incoming.toString());

          switch (payload.type) {
            case "hello":
              logMessage(
                this.nodeName,
                `Received hello from client: ${payload.clientRandom}`
              );
              socket.write(
                JSON.stringify({
                  type: "serverHello",
                  serverRandom: this.randomServerValue,
                  serverCert: this.serverCert,
                })
              );
              logMessage(
                this.nodeName,
                "Sent serverHello with random value and certificate."
              );
              break;

            case "premaster":
              const premasterSecret = CryptoHelper.decryptDataWithPrivateKey(
                this.serverKey,
                Buffer.from(payload.encryptedPremaster, "base64")
              );
              sessionKey = CryptoHelper.computeSessionKey(
                payload.clientRandom,
                this.randomServerValue,
                premasterSecret
              );
              logMessage(this.nodeName, `Session key computed: ${sessionKey}`);

              const readyMessage = CryptoHelper.encodeWithSessionKey(
                sessionKey,
                "serverReady"
              );
              socket.write(
                JSON.stringify({
                  type: "ready",
                  serverRandom: this.randomServerValue,
                  message: readyMessage,
                })
              );
              logMessage(this.nodeName, "Sent serverReady message to client.");
              break;

            default:
              logMessage(
                this.nodeName,
                `Received unexpected message type: ${payload.type}`
              );
          }
        });

        socket.on("error", (err) =>
          logMessage(this.nodeName, `Socket error occurred: ${err.message}`)
        );
      });

      serverInstance.listen(this.nodePort, () => {
        logMessage(
          this.nodeName,
          `Server is now active and listening on port ${this.nodePort}`
        );
        resolve();
      });
    });
  }

  async establishConnection(peerInfo) {
    return new Promise((resolve) => {
      const clientSocket = new net.Socket();
      const clientRandomValue = CryptoHelper.createRandomString();
      let sessionKey;
      let premaster;

      logMessage(
        this.nodeName,
        `Starting connection process to ${peerInfo.name}...`
      );

      clientSocket.connect(peerInfo.port, "localhost", async () => {
        logMessage(
          this.nodeName,
          `Connected to ${peerInfo.name}. Sending hello...`
        );
        clientSocket.write(
          JSON.stringify({ type: "hello", clientRandom: clientRandomValue })
        );
      });

      clientSocket.on("data", async (data) => {
        const response = JSON.parse(data.toString());

        if (response.type === "serverHello") {
          logMessage(
            this.nodeName,
            `Received serverHello from ${peerInfo.name}. Verifying certificate...`
          );
          const isCertValid = this.validateCertificate(response.serverCert);

          if (!isCertValid) {
            logMessage(
              this.nodeName,
              `Certificate verification failed for ${peerInfo.name}. Disconnecting...`
            );
            clientSocket.destroy();
            resolve();
            return;
          }

          logMessage(
            this.nodeName,
            "Certificate verified. Generating premaster secret..."
          );
          premaster = CryptoHelper.createRandomString();
          const encryptedPremaster = CryptoHelper.encryptDataWithPublicKey(
            response.serverCert.publicKey,
            premaster
          );

          clientSocket.write(
            JSON.stringify({
              type: "premaster",
              clientRandom: clientRandomValue,
              encryptedPremaster: encryptedPremaster.toString("base64"),
            })
          );
        } else if (response.type === "ready") {
          sessionKey = CryptoHelper.computeSessionKey(
            clientRandomValue,
            response.serverRandom,
            premaster
          );

          logMessage(
            this.nodeName,
            `Session key established with ${peerInfo.name}: ${sessionKey}`
          );

          const serverResponse = CryptoHelper.decodeWithSessionKey(
            sessionKey,
            response.message
          );

          if (serverResponse === "serverReady") {
            logMessage(
              this.nodeName,
              `Handshake completed successfully with ${peerInfo.name}.`
            );
            this.activeClientConnections.push({
              peerName: peerInfo.name,
              peerPort: peerInfo.port,
              sessionKey,
              socket: clientSocket,
            });
            resolve();
          } else {
            logMessage(
              this.nodeName,
              `Unexpected response during handshake with ${peerInfo.name}.`
            );
          }
        }
      });

      clientSocket.on("error", (err) => {
        logMessage(
          this.nodeName,
          `Error during connection process with ${peerInfo.name}: ${err.message}`
        );
        resolve();
      });
    });
  }

  validateCertificate(cert) {
    const certificateWithoutSignature = { ...cert };
    delete certificateWithoutSignature.signature;

    return CryptoHelper.verifySignature(this.caCert.publicKey, cert);
  }
}

module.exports = Node;
