import _ from 'lodash'
import {
  SigningStargateClient,
  calculateFee,
  assertIsDeliverTxSuccess,
  GasPrice
} from '@cosmjs/stargate'

const SigningClient = async (network, signer, key) => {

  const client = await SigningStargateClient.connectWithSigner(
    network.rpcUrl,
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
    if(!gas) gas = 180_000
    if(!gasPrice) gasPrice = GasPrice.fromString(network.gasPrice);
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

  return {
    registry: client.registry,
    chainId: client.chainId,
    getAddress,
    getFee,
    getIsNanoLedger,
    signAndBroadcast,
    signAndBroadcastWithoutBalanceCheck
  }
}

export default SigningClient;
