const crypto = require("crypto");

class CryptoHelper {
  static createKeyPair = () => {
    const keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 3072 });
    return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
  };

  static parsePrivateKey = (key) =>
    typeof key === "object" && key.type === "private"
      ? key
      : crypto.createPrivateKey(key);

  static signPayload = (privKey, payload) => {
    const signer = crypto.createSign("sha512");
    signer.update(payload);
    signer.end();
    return signer.sign(privKey, "base64");
  };
}

module.exports = CryptoHelper;
