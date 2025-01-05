const Network = require("./network");

(async () => {
  console.log("CA certificate and keys already exist.");

  const network = new Network({
    nodes: ["Node1", "Node2", "Node3"],
  });

  await network.initializeNodes();
})();
