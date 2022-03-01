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
    const fee = getFee(gas, gasPrice)
    return new Promise((success, reject) => {
        client.signAndBroadcast(address, msgs, fee, memo).then((result) => {
          try {
            assertIsDeliverTxSuccess(result);
            success(result)
          } catch (error) {
            reject(error)
          }
        }, (error) => {
          reject(error)
        })
      client.disconnect();
    });
  }

  function findAvailableUrl(urls){
    return findAsync(urls, (url) => {
      return axios.get(url + '/health')
        .then(res => res.data)
        .then(data => {
          return !!data.result
        }).catch(error => {
          return false
        })
    })
  }

  function mapAsync(array, callbackfn) {
    return Promise.all(array.map(callbackfn));
  }

  function findAsync(array, callbackfn) {
    return mapAsync(array, callbackfn).then(findMap => {
      return array.find((value, index) => findMap[index]);
    });
  }

  return {
    connected: !!rpcUrl,
    registry: client && client.registry,
    client,
    chainId,
    getAddress,
    getFee,
    getIsNanoLedger,
    signAndBroadcast,
    signAndBroadcastWithoutBalanceCheck
  }
}

export default SigningClient;
