import * as path from "node:path";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: "bdd", timeout: 30000 });
  mocha.addFile(path.join(__dirname, `${process.env.OUTSKIRTS_SUITE ?? "scan"}.test.js`));
  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${String(failures)} integration test(s) failed.`));
      } else {
        resolve();
      }
    });
  });
}
