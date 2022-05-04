import _ from 'lodash'
import {
  SigningStargateClient,
  assertIsDeliverTxSuccess,
  GasPrice
} from '@cosmjs/stargate'
import { multiply, ceil, bignumber } from 'mathjs'
import { coin } from './Helpers.mjs'

async function SigningClient(rpcUrl, defaultGasPrice, defaultGasModifier, signer, key, signerOpts) {

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

  // vendored to handle large integers
  // https://github.com/cosmos/cosmjs/blob/0f0c9d8a754cbf01e17acf51d3f2dbdeaae60757/packages/stargate/src/fee.ts
  function calculateFee(gasLimit, gasPrice) {
    const processedGasPrice = typeof gasPrice === "string" ? GasPrice.fromString(gasPrice) : gasPrice;
    const { denom, amount: gasPriceAmount } = processedGasPrice;
    const amount = ceil(bignumber(multiply(bignumber(gasPriceAmount.toString()), bignumber(gasLimit.toString()))));
    return {
      amount: [coin(amount, denom)],
      gas: gasLimit.toString(),
    };
  }

  function getFee(gas, gasPrice) {
    if (!gas)
      gas = 200000;
    return calculateFee(gas, gasPrice || defaultGasPrice);
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
    return (parseInt(estimate * (modifier || defaultGasModifier)));
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
