const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

class FilesHelper {
  static async writeToFile(filePath, data) {
    await fsp.writeFile(filePath, data, "utf8");
  }

  static async readFromFile(filePath) {
    return await fsp.readFile(filePath, "utf8");
  }

  static readFromFileSync(filePath) {
    return fs.readFileSync(filePath, "utf8");
  }

  static async ensureDirectoryExists(dirPath) {
    await fsp.mkdir(dirPath, { recursive: true });
  }

  static joinPaths(...paths) {
    return path.join(...paths);
  }

  static async fileExists(filePath) {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = FilesHelper;
