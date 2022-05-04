import { Autostake } from "./base.mjs";

const autostake = new Autostake();
const networkName = process.argv.slice(2, process.argv.length)
autostake.run(networkName)
