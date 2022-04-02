import _ from 'lodash'
import {
  SigningStargateClient,
  calculateFee,
  assertIsDeliverTxSuccess,
  GasPrice
} from '@cosmjs/stargate'

async function SigningClient(rpcUrl, defaultGasPrice, signer, key, signerOpts) {

  const client = rpcUrl && await SigningStargateClient.connectWithSigner(
    rpcUrl,
    signer,
    signerOpts
  );

  async function getAddress() {
    const accounts = await signer.getAccounts();
    return accounts[0].address;
  }

  function getIsNanoLedger() {
    return key.isNanoLedger;
  }

  function getFee(gas, gasPrice) {
    if (!gas)
      gas = 200000;
    if (!gasPrice)
      gasPrice = GasPrice.fromString(defaultGasPrice);
    return calculateFee(gas, gasPrice);
  }

  function signAndBroadcastWithoutBalanceCheck(address, msgs, gas, memo, gasPrice) {
    const defaultOptions = _.clone(signer.keplr.defaultOptions);
    _.merge(signer.keplr.defaultOptions, {
      sign: { disableBalanceCheck: true }
    });
    return signAndBroadcast(address, msgs, gas, memo, gasPrice).finally(() => {
      signer.keplr.defaultOptions = defaultOptions;
    });
  }

  async function signAndBroadcast(address, msgs, gas, memo, gasPrice) {
    return new Promise(async (success, reject) => {
      let fee;
      try {
        if (!gas)
          gas = await simulate(address, msgs, memo);
        fee = getFee(gas, gasPrice);
      } catch (error) {
        return reject(error);
      }
      client.signAndBroadcast(address, msgs, fee, memo).then((result) => {
        try {
          assertIsDeliverTxSuccess(result);
          client.disconnect();
          success(result);
        } catch (error) {
          reject(error);
        }
      }, (error) => {
        reject(error);
      });
    });
  }

  async function simulate(address, msgs, memo, modifier) {
    const estimate = await client.simulate(address, msgs, memo);
    return (parseInt(estimate * (modifier || 1.5)));
  }

  return {
    connected: !!rpcUrl,
    registry: client && client.registry,
    rpcUrl,
    client,
    getAddress,
    getFee,
    getIsNanoLedger,
    simulate,
    signAndBroadcast,
    signAndBroadcastWithoutBalanceCheck
  };
}

export default SigningClient;
