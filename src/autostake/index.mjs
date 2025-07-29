import fs from 'fs'
import _ from 'lodash'

import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Slip10RawIndex, pathToString } from "@cosmjs/crypto";

import { Wallet as EthWallet } from "@ethersproject/wallet";

import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx.js";

import Network from '../utils/Network.mjs'
import Wallet from '../utils/Wallet.mjs';
import NetworkRunner from './NetworkRunner.mjs';
import Health from './Health.mjs';
import { executeSync, overrideNetworks, createLogger } from '../utils/Helpers.mjs'
import EthSigner from '../utils/EthSigner.mjs';

export default function Autostake(mnemonic, opts) {
  const mainLogger = createLogger('autostake')

  opts = opts || {}
  let failed = false

  if (!mnemonic) {
    mainLogger.error('Please provide a MNEMONIC environment variable')
    process.exit()
  }

  async function run(networkNames, networksOverridePath,onlyOperators) {
    const networks = getNetworksData(networksOverridePath)
    for (const name of networkNames) {
      if (name && !networks.map(el => el.name).includes(name)){
        // Assume network will be found in Chain Registry
        networks.push({ name, path: name })
      }
    }
    const calls = networks.map(data => {
      return async () => {
        if (networkNames && networkNames.length && !networkNames.includes(data.name)) return
        if (data.enabled === false) return

        const health = new Health(data.healthCheck, { dryRun: opts.dryRun, networkName: data.name })
        health.started(onlyOperators,'⚛')
        const results = await runWithRetry(data, health, undefined, undefined, onlyOperators)
        const network = results[0]?.networkRunner?.network
        const { success, skipped } = results[results.length - 1] || {}
        if(!skipped && !failed){
          health.log(`Autostake ${success ? 'completed' : 'failed'} after ${results.length} attempt(s)`)
          results.forEach(({networkRunner, error}, index) => {
            health.log(`Attempt ${index + 1}:`)
            logSummary(health, networkRunner, error)
          })
        }
        if (success) {
            return health.success(`Autostake finished for ${network?.prettyName || data.name}`)
        } else if (skipped){
            if (!onlyOperators) {
                return health.success(`Autostake skipped for ${network?.prettyName || data.name}`)
            }
        }else {
          return health.failed(`Autostake failed for ${network?.prettyName || data.name}`)
        }
      }
    })
    await executeSync(calls, 1)
  }

  async function runWithRetry(data, health, retries, runners, onlyOperators) {
    retries = retries || 0
    runners = runners || []
    const maxRetries = data.autostake?.retries ?? 2
    let { failedAddresses } = runners[runners.length - 1] || {}
    let networkRunner, error
    try {

      networkRunner = await getNetworkRunner(data,onlyOperators)
      if (!networkRunner){
        runners.push({ skipped: true })
        return runners
      }

      await networkRunner.run(failedAddresses?.length && failedAddresses)
      if (!networkRunner.didSucceed()) {
        error = networkRunner.error?.message
        failedAddresses = networkRunner.failedAddresses()
      }
    } catch (e) {
      error = e.message
    }
    if (networkRunner?.didSucceed) {
      runners.push({ success: networkRunner?.didSucceed(), networkRunner, error, failedAddresses })
    }

    if (!networkRunner?.didSucceed() && !networkRunner?.forceFail && retries < maxRetries && !failed) {
      await logResults(health, networkRunner, error, `Failed attempt ${retries + 1}/${maxRetries + 1}, retrying in 30 seconds...`)
      await new Promise(r => setTimeout(r, 30 * 1000));
      return await runWithRetry(data, health, retries + 1, runners, onlyOperators)
    }
    await logResults(health, networkRunner, error)
    return runners
  }

  function logResults(health, networkRunner, error, message) {
    if(networkRunner){
      health.addLogs(networkRunner.queryErrors())
    }
    logSummary(health, networkRunner, error)
    if (message) health.log(message)
    return health.sendLog()
  }

  function logSummary(health, networkRunner, error) {
    if(networkRunner){
      const { results } = networkRunner
      const errors = results.filter(result => result.error)
      health.log(`Sent ${results.length - errors.length}/${results.length} transactions`)
      for (let [index, result] of results.entries()) {
        health.log(`TX ${index + 1}:`, result.message);
      }
    }
    if (error) health.log(`Failed with error: ${error}`)
  }

  async function getNetworkRunner(data,onlyOperators) {
      const network = new Network(data)
      let config = {...opts}
      try {
          await network.load()
      } catch (e) {
          if (e.response.status === 404) {
              failed = true
              throw new Error(`${network.name} not found in Chain Registry`)
          }
          throw new Error(`Unable to load network data for ${network.name}`)
      }

      const logger = mainLogger.child({chain: network.name})
      if (!onlyOperators) {
          logger.info('Loaded chain', {prettyName: network.prettyName})
      }

      const {signer, slip44} = await getSigner(network, onlyOperators)
      const wallet = new Wallet(network, signer)
      const botAddress = await wallet.getAddress()
      if (onlyOperators) {
          if (!network.getOperatorByBotAddress(botAddress)) {
              return
          } else {
              logger.info('Loaded', {prettyName: network.prettyName})
          }
          logger.info('Bot address', {address: botAddress})

          if (network.slip44 && network.slip44 !== slip44) {
              logger.warn("!! You are not using the preferred derivation path !!")
              logger.warn("!! You should switch to the correct path unless you have grants. Check the README !!")
        }


    }
    const operator = network.getOperatorByBotAddress(botAddress)
    if (!operator) return  logger.info('Not an operator')
    if (!network.authzSupport) return logger.info('No Authz support')

    await network.connect({ timeout: config.delegationsTimeout || 20000 })

    const { restUrl, usingDirectory } = network

    if (!restUrl) throw new Error('Could not connect to REST API')

    logger.info('Using REST URL', { url: restUrl })

    if (usingDirectory) {
      logger.warn('You are using public nodes, they may not be reliable. Check the README to use your own')
      logger.warn('Delaying briefly and adjusting config to reduce load...')
      config = {...config, batchPageSize: 50, batchQueries: 10, queryThrottle: 2500}
   //   await new Promise(r => setTimeout(r, (Math.random() * 31) * 1000));
    }

    const signingClient = wallet.signingClient()
    signingClient.registry.register("/cosmos.authz.v1beta1.MsgExec", MsgExec)

    return new NetworkRunner(
      network,
      operator,
      signingClient,
      config
    )
  }

  async function getSigner(network, onlyOperators) {
    const logger = mainLogger.child({ chain: network.name })

    let slip44
    if (network.data.autostake?.correctSlip44 || network.slip44 === 60) {
      if (network.slip44 === 60) {
          if (!onlyOperators) {
              logger.info('Found ETH coin type')
        }
      }
      slip44 = network.slip44 || 118
    } else {
      slip44 = network.data.autostake?.slip44 || 118
    }
    let hdPath = [
      Slip10RawIndex.hardened(44),
      Slip10RawIndex.hardened(slip44),
      Slip10RawIndex.hardened(0),
      Slip10RawIndex.normal(0),
      Slip10RawIndex.normal(0),
    ];
    if (slip44 !== 118 && !onlyOperators) {
        logger.info('Using HD Path', { path: pathToString(hdPath) })
    }

    let signer = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: network.prefix,
      hdPaths: [hdPath]
    });

    if (slip44 === 60) {
      const ethSigner = EthWallet.fromMnemonic(mnemonic);
      signer = EthSigner(signer, ethSigner, network.prefix)
    }

    return { signer, slip44 }
  }

  function getNetworksData(networksOverridePath) {
    const networksData = fs.readFileSync('src/networks.json');
    const networks = JSON.parse(networksData);
    try {
      const overridesData = fs.readFileSync(networksOverridePath);
      mainLogger.info("Loading networks.local.json for overrides",{file: networksOverridePath})
      const overrides = overridesData && JSON.parse(overridesData) || {}
      return overrideNetworks(networks, overrides)
    } catch (error) {
      mainLogger.error('Failed to parse networks.local.json, check JSON is valid', { message: error.message })
      return networks
    }
  }

  return {
    run
  }
}
