const Node = require("./node");

class Network {
  constructor({ nodes }) {
    this.nodes = nodes.map((name, index) => new Node(name, 3000 + index + 1));
  }

  async initializeNodes() {
    console.log("Initializing all nodes...");
    await Promise.all(this.nodes.map((node) => node.initializeNode()));

    console.log("Launching servers...");
    await Promise.all(this.nodes.map((node) => node.launchServer()));
  }
}

module.exports = Network;
