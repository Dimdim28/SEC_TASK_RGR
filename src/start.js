const Network = require("./network");

(async () => {
  console.log("CA certificate and keys already exist.");

  const network = new Network({
    nodes: ["Node1", "Node2", "Node3"],
    // connections: [
    //   { name: "Node1", peers: ["Node2"] },
    //   { name: "Node2", peers: ["Node3"] },
    //   { name: "Node3", peers: ["Node1"] },
    // ],
    files: [
      {
        sender: "Node1",
        receiver: "Node2",
        filePath: "./textFromNode1to2.txt",
      },
      {
        sender: "Node1",
        receiver: "Node3",
        filePath: "./textFromNode1to3.txt",
      },
      {
        sender: "Node2",
        receiver: "Node1",
        filePath: "./textFromNode2to1.txt",
      },
      {
        sender: "Node2",
        receiver: "Node3",
        filePath: "./textFromNode2to3.txt",
      },
      {
        sender: "Node3",
        receiver: "Node1",
        filePath: "./textFromNode3to1.txt",
      },
      {
        sender: "Node3",
        receiver: "Node2",
        filePath: "./textFromNode3to2.txt",
      },
    ],
  });

  await network.initializeNodes();
  await network.establishConnections();
  await network.sendFiles();
})();
