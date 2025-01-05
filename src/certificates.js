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
}

(async () => {
  await CertificationManager.verifyDirectoryStructure();
  await CertificationManager.initializeCertificateAuthority();
})();

module.exports = { CertificationManager };
