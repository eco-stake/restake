import 'dotenv/config'
import Autostake from "../src/autostake/index.mjs";

const mnemonic = process.env.MNEMONIC
const networksOverridePath = process.env.NETWORKS_OVERRIDE_PATH || 'src/networks.local.json'
const autostake = new Autostake(mnemonic, { dryRun: true });
const networkName = process.argv.slice(2, process.argv.length)
autostake.run(networkName, networksOverridePath)
