const net = require("net");

const { CertificationManager } = require("./certificates");
const CryptoHelper = require("./cryptoHelper");
const { KEY_SERVER_PORT } = require("./constants");

const server = net.createServer((socket) => {
  console.log("Node connected to Key Server.");

  socket.on("data", async (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log("Received message from Node:", message);

      if (message.type === "generateKeys" && message.nodeName) {
        console.log(`Generating certificate for node ${message.nodeName}...`);

        const serverKeys = CryptoHelper.createKeyPair();

        const serverCertificate =
          await CertificationManager.issueServerCertificate(
            serverKeys.publicKey,
            message.nodeName
          );

        const response = {
          type: "keyPair",
          publicKey: serverKeys.publicKey.export({
            type: "pkcs1",
            format: "pem",
          }),
          privateKey: serverKeys.privateKey.export({
            type: "pkcs1",
            format: "pem",
          }),
          certificate: serverCertificate,
        };

        console.log("Sending response to Node:", response);
        socket.write(JSON.stringify(response));
        console.log(`Certificate and keys sent to node ${message.nodeName}.`);
      } else {
        console.error(
          "Invalid request. Node name is missing or type is incorrect."
        );
        socket.write(
          JSON.stringify({
            error: true,
            message:
              "Invalid request. 'type' must be 'generateKeys' and 'nodeName' is required.",
          })
        );
      }
    } catch (error) {
      console.error("Error processing client request:", error.message);
      socket.write(
        JSON.stringify({
          error: true,
          message: error.message,
        })
      );
    }
  });

  socket.on("error", (err) => {
    console.error("Error in Key Server:", err.message);
  });
});

server.listen(KEY_SERVER_PORT, () => {
  console.log(`Key Server is running on port ${KEY_SERVER_PORT}`);
});
