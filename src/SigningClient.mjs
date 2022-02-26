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

  const signAndBroadcast = async (address, msgs, gas, memo, gasPrice) => {
    if(!gas) gas = 180_000
    if(!gasPrice) gasPrice = GasPrice.fromString(network.gasPrice);
    const fee = calculateFee(gas, gasPrice);
    return new Promise((success, reject) => {
      try {
        client.signAndBroadcast(address, msgs, fee, memo).then((result) => {
          assertIsDeliverTxSuccess(result);
          success(result)
        }, (error) => {
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
      client.disconnect();
    });
  }

  return {
    registry: client.registry,
    chainId: client.chainId,
    getAddress,
    getIsNanoLedger,
    signAndBroadcast
  }
}

export default SigningClient;
