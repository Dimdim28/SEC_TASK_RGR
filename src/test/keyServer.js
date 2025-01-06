const net = require("net");
const { KEY_SERVER_PORT } = require("../constants");

const testKeyServer = async () => {
  console.log("Starting Key Server test...");

  const clientSocket = new net.Socket();

  clientSocket.connect(KEY_SERVER_PORT, "localhost", () => {
    console.log("Connected to Key Server.");

    const request = {
      type: "generateKeys",
      nodeName: "TestNode",
    };

    console.log("Sending request to Key Server:", request);
    clientSocket.write(JSON.stringify(request));
  });

  clientSocket.on("data", (data) => {
    try {
      const response = JSON.parse(data.toString());
      console.log("Received response from Key Server:", response);

      if (response.type === "keyPair") {
        console.log("Key pair and certificate generated successfully!");
        console.log("Public Key:", response.publicKey);
        console.log("Private Key:", response.privateKey);
        console.log("Certificate:", response.certificate);
      } else if (response.error) {
        console.error("Error from Key Server:", response.message);
      }

      clientSocket.destroy();
    } catch (err) {
      console.error("Error parsing response from Key Server:", err.message);
    }
  });

  clientSocket.on("error", (err) => {
    console.error("Error in client socket:", err.message);
  });

  clientSocket.on("close", () => {
    console.log("Connection to Key Server closed.");
  });
};

testKeyServer();
