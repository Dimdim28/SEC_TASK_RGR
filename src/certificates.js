const CryptoHelper = require("./cryptoHelper");
const FilesHelper = require("./filesHelper");

const { CERT_DIR, CA_CERT_PATH, CA_KEY_PATH } = require("./constants");

class CertificationManager {
  static #caKeys = null;

  static async verifyDirectoryStructure() {
    await FilesHelper.ensureDirectoryExists(CERT_DIR);
    console.log("Certificate storage directory verified.");
  }

  static async initializeCertificateAuthority() {
    const isCertExists = await FilesHelper.fileExists(CA_CERT_PATH);
    const isKeyExists = await FilesHelper.fileExists(CA_KEY_PATH);

    if (isCertExists && isKeyExists) {
      console.log("Root certificate and keys are already present.");
      CertificationManager.#caKeys = {
        publicKey: null,
        privateKey: await FilesHelper.readFromFile(CA_KEY_PATH),
      };
      return JSON.parse(await FilesHelper.readFromFile(CA_CERT_PATH));
    }

    console.log("Creating root certificate and key pair...");
    CertificationManager.#caKeys = CryptoHelper.createKeyPair();

    const authorityCertificate = {
      issuer: "Root Authority",
      validFrom: new Date(),
      validUntil: new Date(
        new Date().setFullYear(new Date().getFullYear() + 1)
      ),
      publicKey: CertificationManager.#caKeys.publicKey.export({
        type: "pkcs1",
        format: "pem",
      }),
    };

    await FilesHelper.writeToFile(
      CA_CERT_PATH,
      JSON.stringify(authorityCertificate)
    );
    await FilesHelper.writeToFile(
      CA_KEY_PATH,
      CertificationManager.#caKeys.privateKey.export({
        type: "pkcs1",
        format: "pem",
      })
    );

    console.log("Root certificate authority initialized successfully.");
    return authorityCertificate;
  }

  static async issueServerCertificate(serverPublicKey, serverName) {
    if (!CertificationManager.#caKeys) {
      throw new Error(
        "Root keys not found. Initialize the Certificate Authority first."
      );
    }

    const serverCertificateDetails = {
      subject: serverName,
      issuedAt: new Date(),
      expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      publicKey: serverPublicKey.export({ type: "pkcs1", format: "pem" }),
      authority: "Root Authority",
    };

    const authorityPrivateKey = CryptoHelper.parsePrivateKey(
      CertificationManager.#caKeys.privateKey
    );
    const digitalSignature = CryptoHelper.signPayload(
      authorityPrivateKey,
      JSON.stringify(serverCertificateDetails)
    );

    serverCertificateDetails.signature = digitalSignature;
    return serverCertificateDetails;
  }

  static async createServerCertificate(serverName) {
    const serverCertPath = FilesHelper.joinPaths(
      CERT_DIR,
      `${serverName}-cert.pem`
    );
    const serverKeyPath = FilesHelper.joinPaths(
      CERT_DIR,
      `${serverName}-key.pem`
    );

    if (
      (await FilesHelper.fileExists(serverCertPath)) &&
      (await FilesHelper.fileExists(serverKeyPath))
    ) {
      console.log(
        `Certificates for server "${serverName}" already exist. Skipping creation.`
      );
      return;
    }

    const serverKeyPair = CryptoHelper.createKeyPair();
    const serverCertificate = await this.issueServerCertificate(
      serverKeyPair.publicKey,
      serverName
    );

    await FilesHelper.writeToFile(
      serverCertPath,
      JSON.stringify(serverCertificate)
    );
    await FilesHelper.writeToFile(
      serverKeyPath,
      serverKeyPair.privateKey.export({ type: "pkcs1", format: "pem" })
    );

    console.log(
      `Certificate and private key generated for server "${serverName}".`
    );
  }
}

(async () => {
  await CertificationManager.verifyDirectoryStructure();
  await CertificationManager.initializeCertificateAuthority();
  await CertificationManager.createServerCertificate("AppServerTest");
})();

module.exports = { CertificationManager };
