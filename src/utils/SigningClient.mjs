import _ from 'lodash'
import axios from 'axios'
import { multiply, ceil, bignumber } from 'mathjs'
import Long from "long";

import {
  defaultRegistryTypes as defaultStargateTypes,
  assertIsDeliverTxSuccess,
  GasPrice,
  AminoTypes,
  createAuthzAminoConverters,
  createBankAminoConverters,
  createDistributionAminoConverters,
  createFreegrantAminoConverters,
  createGovAminoConverters,
  createIbcAminoConverters,
  createStakingAminoConverters,
} from "@cosmjs/stargate";
import { sleep } from "@cosmjs/utils";
import { makeSignDoc, Registry } from "@cosmjs/proto-signing";
import { makeSignDoc as makeAminoSignDoc } from "@cosmjs/amino";
import { toBase64, fromBase64 } from '@cosmjs/encoding'
import { PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys.js";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing.js";
import { AuthInfo, Fee, TxBody, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";

import { coin } from './Helpers.mjs'

async function SigningClient(network, defaultGasPrice, signer, key) {

  const { restUrl, gasModifier: defaultGasModifier, slip44: coinType, chainId } = network

  const registry = new Registry(defaultStargateTypes);
  const aminoTypes = new AminoTypes({
    ...createAuthzAminoConverters(),
    ...createBankAminoConverters(),
    ...createDistributionAminoConverters(),
    ...createGovAminoConverters(),
    ...createStakingAminoConverters(network.prefix),
    ...createIbcAminoConverters(),
    ...createFreegrantAminoConverters(),
  })

  function getAccount(address) {
    return axios
      .get(restUrl + "/cosmos/auth/v1beta1/accounts/" + address)
      .then((res) => res.data.account)
      .then((value) => value.BaseAccount || value.baseAccount || value.base_account || value)
  };

  function getIsNanoLedger() {
    if(!key) return false
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
      gasLimit: gasLimit.toString()
    };
  }

  function getFee(gas, gasPrice) {
    if (!gas)
      gas = 200000;
    return calculateFee(gas, gasPrice || defaultGasPrice);
  }

  async function signAndBroadcastWithoutBalanceCheck(address, msgs, gas, memo, gasPrice) {
    const defaultOptions = _.clone(signer.keplr.defaultOptions);
    _.merge(signer.keplr.defaultOptions, {
      sign: { disableBalanceCheck: true }
    });
    try {
      return await signAndBroadcast(address, msgs, gas, memo, gasPrice)
    } finally {
      signer.keplr.defaultOptions = defaultOptions
    }
  }

  async function signAndBroadcast(address, messages, gas, memo, gasPrice) {
    if (!gas)
      gas = await simulate(address, messages, memo);
    const fee = getFee(gas, gasPrice);
    const txBody = await sign(address, messages, memo, fee)
    return broadcast(txBody)
  }

  async function broadcast(txBody){
    const timeoutMs = network.txTimeout || 60_000
    const pollIntervalMs = 3_000
    let timedOut = false
    const txPollTimeout = setTimeout(() => {
      timedOut = true;
    }, timeoutMs);
    
    const pollForTx = async (txId) => {
      if (timedOut) {
        throw new Error(
          `Transaction with ID ${txId} was submitted but was not yet found on the chain. You might want to check later. There was a wait of ${timeoutMs / 1000} seconds.`
        );
      }
      await sleep(pollIntervalMs);
      try {
        const response = await axios.get(restUrl + '/cosmos/tx/v1beta1/txs/' + txId);
        const result = parseTxResult(response.data.tx_response)
        return result
      } catch {
        return pollForTx(txId);
      }
    };

    const response = await axios.post(restUrl + '/cosmos/tx/v1beta1/txs', {
      tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
      mode: "BROADCAST_MODE_SYNC"
    })
    const result = parseTxResult(response.data.tx_response)
    assertIsDeliverTxSuccess(result)
    return new Promise((resolve, reject) =>
      pollForTx(result.transactionHash).then(
        (value) => {
          clearTimeout(txPollTimeout);
          assertIsDeliverTxSuccess(value)
          resolve(value);
        },
        (error) => {
          clearTimeout(txPollTimeout);
          reject(error);
        },
      ),
    );
  }

  async function sign(address, messages, memo, fee){
    const account = await getAccount(address)
    const { account_number: accountNumber, sequence } = account
    const txBodyBytes = makeBodyBytes(messages, memo)
    if(getIsNanoLedger()){
      // Convert to amino for ledger devices
      const aminoMsgs = messages.map(el => aminoTypes.toAmino(el))
      const signDoc = makeAminoSignDoc(aminoMsgs, fee, chainId, memo, accountNumber, sequence);
      const { signature, signed } = await signer.sign(address, signDoc);
      const authInfoBytes = await makeAuthInfoBytes(account, {
        amount: signed.fee.amount,
        gasLimit: signed.fee.gas,
      })
      return {
        bodyBytes: txBodyBytes,
        authInfoBytes: authInfoBytes,
        signatures: [Buffer.from(signature.signature, "base64")],
      }
    }else{
      // Sign using standard protobuf messages
      const authInfoBytes = await makeAuthInfoBytes(account, {
        amount: fee.amount,
        gasLimit: fee.gas,
      })
      const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, chainId, accountNumber);
      const { signature, signed } = await signer.signDirect(address, signDoc);
      return {
        bodyBytes: signed.bodyBytes,
        authInfoBytes: signed.authInfoBytes,
        signatures: [fromBase64(signature.signature)],
      }
    }
  }

  async function simulate(address, messages, memo, modifier) {
    const account = await getAccount(address)
    const txBody = {
      bodyBytes: makeBodyBytes(messages, memo),
      authInfoBytes: await makeAuthInfoBytes(account, {}, SignMode.SIGN_MODE_UNSPECIFIED),
      signatures: [new Uint8Array()],
    }

    const estimate = await axios.post(restUrl + '/cosmos/tx/v1beta1/simulate', {
      tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
    }).then(el => el.data.gas_info.gas_used)
    return (parseInt(estimate * (modifier || defaultGasModifier)));
  }

  function parseTxResult(result){
    return {
      code: result.code,
      height: result.height,
      rawLog: result.raw_log,
      transactionHash: result.txhash,
      gasUsed: result.gas_used,
      gasWanted: result.gas_wanted,
    }
  }

  function makeBodyBytes(messages, memo){
    const anyMsgs = messages.map((m) => registry.encodeAsAny(m));
    return TxBody.encode(
      TxBody.fromPartial({
        messages: anyMsgs,
        memo: memo,
      })
    ).finish()
  }

  async function makeAuthInfoBytes(account, fee, mode){
    mode = mode || getIsNanoLedger() ? SignMode.SIGN_MODE_LEGACY_AMINO_JSON : SignMode.SIGN_MODE_DIRECT
    const { sequence } = account
    const accountFromSigner = (await signer.getAccounts())[0]
    if (!accountFromSigner) {
      throw new Error("Failed to retrieve account from signer");
    }
    const pubkey = accountFromSigner.pubkey;
    return AuthInfo.encode({
      signerInfos: [
        {
          publicKey: {
            typeUrl:
              coinType === 60
                ? "/ethermint.crypto.v1.ethsecp256k1.PubKey"
                : "/cosmos.crypto.secp256k1.PubKey",
            value: PubKey.encode({
              key: pubkey,
            }).finish(),
          },
          sequence: Long.fromNumber(sequence, true),
          modeInfo: { single: { mode: mode } },
        },
      ],
      fee: Fee.fromPartial(fee),
    }).finish()
  }

  return {
    registry,
    getFee,
    getIsNanoLedger,
    simulate,
    signAndBroadcast,
    signAndBroadcastWithoutBalanceCheck
  };
}

export default SigningClient;
