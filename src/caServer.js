const net = require("net");

const FilesHelper = require("./filesHelper");
const CryptoHelper = require("./cryptoHelper");

const { CA_CERT_PATH, CA_SERVER_PORT } = require("./constants");

class CertificateAuthorityServer {
  constructor() {
    this.rootCertificate = JSON.parse(
      FilesHelper.readFromFileSync(CA_CERT_PATH)
    );
  }

  startServer() {
    const caServerInstance = net.createServer((clientSocket) => {
      console.log("Certificate Authority: Client connected.");

      clientSocket.on("data", (incomingData) => {
        const clientRequest = JSON.parse(incomingData.toString());

        if (clientRequest.type === "verifyCertificate") {
          console.log("Certificate Authority: Verification request received.");
          const isCertificateValid = this.validateCertificate(
            clientRequest.certificate
          );
          clientSocket.write(JSON.stringify({ verified: isCertificateValid }));
          console.log("Certificate Authority: Verification result sent.");
        } else {
          console.log("Certificate Authority: Received invalid request type.");
        }
      });

      clientSocket.on("error", (error) => {
        console.error(
          "Certificate Authority: Client socket error:",
          error.message
        );
      });
    });

    caServerInstance.listen(CA_SERVER_PORT, () => {
      console.log(
        `Certificate Authority: Service running on port ${CA_SERVER_PORT}`
      );
    });
  }

  validateCertificate(certToVerify) {
    const certificateWithoutSignature = { ...certToVerify };
    delete certificateWithoutSignature.signature;

    return CryptoHelper.verifySignature(
      this.rootCertificate.publicKey,
      certToVerify
    );
  }
}

const certificateAuthority = new CertificateAuthorityServer();
certificateAuthority.startServer();

module.exports = CertificateAuthorityServer;
