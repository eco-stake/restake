import { Autostake } from "./base.mjs";

const autostake = new Autostake();
const networkName = process.argv[2]
autostake.run(networkName)
