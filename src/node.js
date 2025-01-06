const net = require("net");
const CryptoHelper = require("./cryptoHelper");
const FilesHelper = require("./filesHelper");
const {
  CERT_DIR,
  CA_SERVER_PORT,
  KEY_SERVER_PORT,
  RECEIVED_DIR,
} = require("./constants");

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

    if (
      (await FilesHelper.fileExists(serverCertPath)) &&
      (await FilesHelper.fileExists(serverKeyPath))
    ) {
      logMessage(this.nodeName, "Certificate and key files found. Loading...");
      this.nodeCert = JSON.parse(
        await FilesHelper.readFromFile(serverCertPath)
      );
      this.privateKey = await FilesHelper.readFromFile(serverKeyPath);
      logMessage(this.nodeName, "Loaded existing certificate and key.");
    } else {
      const clientSocket = new net.Socket();
      return new Promise((resolve, reject) => {
        clientSocket.connect(KEY_SERVER_PORT, () => {
          logMessage(this.nodeName, "Requesting certificate and keys...");
          clientSocket.write(
            JSON.stringify({ type: "generateKeys", nodeName: this.nodeName })
          );
        });

        clientSocket.on("data", async (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "keyPair") {
            logMessage(
              this.nodeName,
              "Successfully received certificate and keys."
            );
            this.nodeCert = response.certificate;
            this.privateKey = response.privateKey;

            const keyPath = FilesHelper.joinPaths(
              CERT_DIR,
              `${this.nodeName}-key.pem`
            );
            await FilesHelper.writeToFile(keyPath, this.privateKey);

            logMessage(this.nodeName, "Private key saved.");

            const certPath = FilesHelper.joinPaths(
              CERT_DIR,
              `${this.nodeName}-cert.pem`
            );
            await FilesHelper.writeToFile(
              certPath,
              JSON.stringify(this.nodeCert)
            );
            logMessage(this.nodeName, "Certificate saved.");

            resolve();
          } else {
            logMessage(
              this.nodeName,
              "Unexpected response received from Key Server."
            );
            reject(new Error("Unexpected response from Key Server."));
          }
          clientSocket.destroy();
        });

        clientSocket.on("error", (err) => {
          logMessage(
            this.nodeName,
            `Key Server connection failed: ${err.message}`
          );
          reject(err);
        });
      });
    }
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
                  serverCert: this.nodeCert,
                })
              );
              logMessage(
                this.nodeName,
                "Sent serverHello with random value and certificate."
              );
              break;

            case "premaster":
              const premasterSecret = CryptoHelper.decryptDataWithPrivateKey(
                this.privateKey,
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

            case "file":
              logMessage(this.nodeName, "Received file transfer request.");
              if (!sessionKey) {
                logMessage(
                  this.nodeName,
                  "Session key not established. File transfer denied."
                );
                return;
              }
              const decodedData = CryptoHelper.decodeWithSessionKey(
                sessionKey,
                payload.fileData
              );
              const fileDir = FilesHelper.joinPaths(
                RECEIVED_DIR,
                this.nodeName
              );
              await FilesHelper.ensureDirectoryExists(fileDir);

              const filePath = FilesHelper.joinPaths(fileDir, payload.fileName);
              await FilesHelper.writeToFile(filePath, decodedData);
              logMessage(this.nodeName, `File saved to: ${filePath}`);
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
          const isCertValid = await this.validateCertificate(
            response.serverCert
          );

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

          logMessage(
            this.nodeName,
            `Premaster secret encrypted and sent to ${peerInfo.name}...`
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

  async validateCertificate(cert) {
    return new Promise((resolve) => {
      const validationSocket = new net.Socket();
      validationSocket.connect(CA_SERVER_PORT, "localhost", () => {
        validationSocket.write(
          JSON.stringify({ type: "verifyCertificate", certificate: cert })
        );
      });

      validationSocket.on("data", (data) => {
        const result = JSON.parse(data.toString());
        resolve(result.verified);
        validationSocket.destroy();
      });

      validationSocket.on("error", (err) => {
        logMessage(
          this.nodeName,
          `Certificate validation failed: ${err.message}`
        );
        resolve(false);
      });
    });
  }

  async transmitFile(targetPeer, fileLocation) {
    const fileExists = await FilesHelper.fileExists(fileLocation);
    if (!fileExists) {
      logMessage(this.nodeName, `File not found: ${fileLocation}`);
      return;
    }

    const connection = this.activeClientConnections.find(
      (conn) => conn.peerName === targetPeer
    );

    if (!connection) {
      logMessage(this.nodeName, `No active session found with ${targetPeer}`);
      return;
    }

    const fileContent = await FilesHelper.readFromFile(fileLocation);
    const encryptedData = CryptoHelper.encodeWithSessionKey(
      connection.sessionKey,
      fileContent
    );

    connection.socket.write(
      JSON.stringify({
        type: "file",
        fileName: FilesHelper.getFileName(fileLocation),
        fileData: encryptedData,
      })
    );
    logMessage(this.nodeName, `File sent to ${targetPeer}`);
  }
}

module.exports = Node;
