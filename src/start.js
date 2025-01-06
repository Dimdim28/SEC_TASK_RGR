const Network = require("./network");

(async () => {
  console.log("CA certificate and keys already exist.");

  const network = new Network({
    nodes: ["Node1", "Node2"],
    connections: [
      { name: "Node1", peers: ["Node2"] },
      // { name: "Node2", peers: ["Node3"] },
      // { name: "Node3", peers: ["Node1"] },
    ],
  });

  await network.initializeNodes();
  await network.establishConnections();
})();
