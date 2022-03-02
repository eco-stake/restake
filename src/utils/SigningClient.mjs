import {findAsync} from './Helpers.mjs'

import _ from 'lodash'
import {
  SigningStargateClient,
  calculateFee,
  assertIsDeliverTxSuccess,
  GasPrice
} from '@cosmjs/stargate'

import axios from 'axios'

const SigningClient = async (rpcUrl, chainId, defaultGasPrice, signer, key) => {

  const rpcUrls = Array.isArray(rpcUrl) ? rpcUrl : [rpcUrl]
  rpcUrl = await findAvailableUrl(rpcUrls)

  const client = rpcUrl && await SigningStargateClient.connectWithSigner(
    rpcUrl,
    signer
  )

  const getAddress = async () => {
    const accounts = await signer.getAccounts()
    return accounts[0].address
  }

  const getIsNanoLedger = () => {
    return key.isNanoLedger
  }

  const getFee = (gas, gasPrice) => {
    if(!gas) gas = 200_000
    if(!gasPrice) gasPrice = GasPrice.fromString(defaultGasPrice);
    return calculateFee(gas, gasPrice);
  }

  const signAndBroadcastWithoutBalanceCheck = (address, msgs, gas, memo, gasPrice) => {
    const defaultOptions = _.clone(signer.keplr.defaultOptions)
    _.merge(signer.keplr.defaultOptions, {
      sign: { disableBalanceCheck: true }
    })
    return signAndBroadcast(address, msgs, gas, memo, gasPrice).finally(() => {
      signer.keplr.defaultOptions = defaultOptions
    })
  }

  const signAndBroadcast = async (address, msgs, gas, memo, gasPrice) => {
    if(!gas) gas = await simulate(address, msgs, memo)
    const fee = getFee(gas, gasPrice)

    return new Promise((success, reject) => {
        client.signAndBroadcast(address, msgs, fee, memo).then((result) => {
          try {
            assertIsDeliverTxSuccess(result);
            client.disconnect();
            success(result)
          } catch (error) {
            reject(error)
          }
        }, (error) => {
          reject(error)
        })
    });
  }

  const simulate = async (address, msgs, memo, modifier) => {
    const estimate = await client.simulate(address, msgs, memo)
    return parseInt(estimate * (modifier || 1.1))
  }

  function findAvailableUrl(urls){
    return findAsync(urls, (url) => {
      return axios.get(url + '/status?', {timeout: 1000})
        .then(res => res.data)
        .then(data => {
          return data.result.node_info.network === chainId
        }).catch(error => {
          return false
        })
    })
  }

  return {
    connected: !!rpcUrl,
    registry: client && client.registry,
    client,
    chainId,
    getAddress,
    getFee,
    getIsNanoLedger,
    simulate,
    signAndBroadcast,
    signAndBroadcastWithoutBalanceCheck
  }
}

export default SigningClient;
