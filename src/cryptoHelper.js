const crypto = require("crypto");

class CryptoHelper {
  static #encryptionAlgorithm = "aes-256-gcm";

  static createKeyPair = () => {
    const keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 3072 });
    return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
  };

  static verifySignature = (rootPublicKey, certificate) => {
    const certCopy = { ...certificate };
    delete certCopy.signature;

    return crypto.verify(
      "sha512",
      Buffer.from(JSON.stringify(certCopy)),
      rootPublicKey,
      Buffer.from(certificate.signature, "base64")
    );
  };

  static encryptDataWithPublicKey = (pubKey, plaintext) =>
    crypto.publicEncrypt(pubKey, Buffer.from(plaintext));

  static decryptDataWithPrivateKey = (privKey, cipherText) =>
    crypto.privateDecrypt(privKey, cipherText).toString("utf-8");

  static parsePrivateKey = (key) =>
    typeof key === "object" && key.type === "private"
      ? key
      : crypto.createPrivateKey(key);

  static computeSessionKey = (clientRand, serverRand, sharedSecret) => {
    const hashData = `${clientRand}:${serverRand}:${sharedSecret}`;
    const hashed = crypto.createHash("sha512").update(hashData).digest("hex");
    return hashed.substring(0, 64);
  };

  static signPayload = (privKey, payload) => {
    const signer = crypto.createSign("sha512");
    signer.update(payload);
    signer.end();
    return signer.sign(privKey, "base64");
  };

  static encodeWithSessionKey = (sessionKey, payload) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      this.#encryptionAlgorithm,
      Buffer.from(sessionKey, "hex"),
      iv
    );
    const encrypted = `${cipher.update(
      payload,
      "utf8",
      "base64"
    )}${cipher.final("base64")}`;
    const authTag = cipher.getAuthTag().toString("base64");

    return `${iv.toString("base64")}:${authTag}:${encrypted}`;
  };

  static decodeWithSessionKey = (sessionKey, encryptedPayload) => {
    const [ivBase64, authTagBase64, cipherBase64] = encryptedPayload.split(":");
    const decipher = crypto.createDecipheriv(
      this.#encryptionAlgorithm,
      Buffer.from(sessionKey, "hex"),
      Buffer.from(ivBase64, "base64")
    );

    decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));
    const decrypted = `${decipher.update(
      Buffer.from(cipherBase64, "base64"),
      "base64",
      "utf8"
    )}${decipher.final("utf8")}`;
    return decrypted;
  };

  static createRandomString = () => crypto.randomBytes(24).toString("hex");
}

module.exports = CryptoHelper;
