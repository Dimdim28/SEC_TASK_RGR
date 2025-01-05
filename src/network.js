const Node = require("./node");

class Network {
  constructor({ nodes, connections }) {
    this.nodes = nodes.map((name, index) => new Node(name, 3000 + index + 1));
    this.connections = connections || this.#createDefaultConnections();
  }

  #createDefaultConnections() {
    return this.nodes.map((node) => ({
      name: node.nodeName,
      peers: this.nodes
        .filter((peer) => peer.nodeName !== node.nodeName)
        .map((peer) => peer.nodeName),
    }));
  }

  async initializeNodes() {
    console.log("Initializing all nodes...");
    await Promise.all(this.nodes.map((node) => node.initializeNode()));

    console.log("Launching servers...");
    await Promise.all(this.nodes.map((node) => node.launchServer()));
  }

  async establishConnections() {
    console.log("Establishing connections between nodes...");
    for (const { name, peers } of this.connections) {
      const node = this.nodes.find((n) => n.nodeName === name);
      if (!node) {
        console.error(`Node "${name}" not found.`);
        continue;
      }

      const peerNodes = this.nodes.filter((peer) =>
        peers.includes(peer.nodeName)
      );
      console.log(
        `[${node.nodeName}] Connecting to peers:`,
        peerNodes.map((peer) => peer.nodeName)
      );

      await Promise.all(
        peerNodes.map((peer) =>
          node.establishConnection({ name: peer.nodeName, port: peer.nodePort })
        )
      );
    }
    console.log("Connections established between all nodes.");
  }
}

module.exports = Network;
