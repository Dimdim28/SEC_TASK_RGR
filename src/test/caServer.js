const net = require("net");
const CryptoHelper = require("../cryptoHelper");
const FilesHelper = require("../filesHelper");
const { CA_SERVER_PORT } = require("../constants");

(async () => {
  const { publicKey } = CryptoHelper.createKeyPair();

  const dummyCertificate = {
    subject: "TestNode",
    issuedAt: new Date(),
    expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 6)),
    publicKey: publicKey.export({
      type: "pkcs1",
      format: "pem",
    }),
    authority: "Root Authority",
  };

  const caPrivateKey = CryptoHelper.parsePrivateKey(
    FilesHelper.readFromFileSync("../certs/ca-key.pem")
  );
  const signature = CryptoHelper.signPayload(
    caPrivateKey,
    JSON.stringify(dummyCertificate)
  );
  dummyCertificate.signature = signature;

  console.log("Created dummy certificate:", dummyCertificate);

  const clientSocket = new net.Socket();

  clientSocket.connect(CA_SERVER_PORT, "localhost", () => {
    console.log("Connected to CA Server.");

    const request = {
      type: "verifyCertificate",
      certificate: dummyCertificate,
    };

    console.log("Sending verification request to CA Server:", request);
    clientSocket.write(JSON.stringify(request));
  });

  clientSocket.on("data", (data) => {
    const response = JSON.parse(data.toString());
    console.log("Received response from CA Server:", response);

    if (response.verified) {
      console.log("Certificate is valid!");
    } else {
      console.log("Certificate is invalid!");
    }

    clientSocket.destroy();
  });

  clientSocket.on("error", (err) => {
    console.error("Error in client socket:", err.message);
  });

  clientSocket.on("close", () => {
    console.log("Connection to CA Server closed.");
  });
})();
