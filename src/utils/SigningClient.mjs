import _ from 'lodash'
import axios from 'axios'
import { multiply, ceil, bignumber } from 'mathjs'
import Long from "long";

import {
  defaultRegistryTypes as defaultStargateTypes,
  assertIsDeliverTxSuccess,
  GasPrice,
  AminoTypes,
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
import { createAuthzAminoConverters, createAuthzExecAminoConverters } from '../converters/Authz.mjs'

function SigningClient(network, signer) {

  const defaultGasPrice = network.gasPricePrefer || network.gasPrice
  const { restUrl, gasModifier: defaultGasModifier, slip44: coinType, chainId } = network

  const registry = new Registry(defaultStargateTypes);
  const defaultConverters = {
    ...createAuthzAminoConverters(),
    ...createBankAminoConverters(),
    ...createDistributionAminoConverters(),
    ...createGovAminoConverters(),
    ...createStakingAminoConverters(network.prefix),
    ...createIbcAminoConverters(),
    ...createFreegrantAminoConverters(),
  }
  let aminoTypes = new AminoTypes(defaultConverters)
  aminoTypes = new AminoTypes({...defaultConverters, ...createAuthzExecAminoConverters(registry, aminoTypes)})

  function getAccount(address) {
    return axios
      .get(restUrl + "/cosmos/auth/v1beta1/accounts/" + address)
      .then((res) => res.data.account)
      .then((value) => {
        // see https://github.com/chainapsis/keplr-wallet/blob/7ca025d32db7873b7a870e69a4a42b525e379132/packages/cosmos/src/account/index.ts#L73
        // If the chain modifies the account type, handle the case where the account type embeds the base account.
        // (Actually, the only existent case is ethermint, and this is the line for handling ethermint)
        const baseAccount =
          value.BaseAccount || value.baseAccount || value.base_account;
        if (baseAccount) {
          value = baseAccount;
        }

        // If the account is the vesting account that embeds the base vesting account,
        // the actual base account exists under the base vesting account.
        // But, this can be different according to the version of cosmos-sdk.
        // So, anyway, try to parse it by some ways...
        const baseVestingAccount =
          value.BaseVestingAccount ||
          value.baseVestingAccount ||
          value.base_vesting_account;
        if (baseVestingAccount) {
          value = baseVestingAccount;

          const baseAccount =
            value.BaseAccount || value.baseAccount || value.base_account;
          if (baseAccount) {
            value = baseAccount;
          }
        }

        // Handle nested account like Desmos
        const nestedAccount = value.account
        if(nestedAccount){
          value = nestedAccount
        }

        return value 
      })
      .catch((error) => {
        if(error.response?.status === 404){
          throw new Error('Account does not exist on chain')
        }else{
          throw error
        }
      })
  };

  // vendored to handle large integers
  // https://github.com/cosmos/cosmjs/blob/0f0c9d8a754cbf01e17acf51d3f2dbdeaae60757/packages/stargate/src/fee.ts
  function calculateFee(gasLimit, gasPrice) {
    const processedGasPrice = typeof gasPrice === "string" ? GasPrice.fromString(gasPrice) : gasPrice;
    const { denom, amount: gasPriceAmount } = processedGasPrice;
    const amount = ceil(bignumber(multiply(bignumber(gasPriceAmount.toString()), bignumber(gasLimit.toString()))));
    return {
      amount: [coin(amount, denom)],
      gas: gasLimit.toString()
    };
  }

  function getFee(gas, gasPrice) {
    if (!gas)
      gas = 200000;
    return calculateFee(gas, gasPrice || defaultGasPrice);
  }

  async function signAndBroadcastWithoutBalanceCheck(address, msgs, gas, memo, gasPrice) {
    let defaultOptions
    if(signer.keplr.defaultOptions){
      defaultOptions = _.clone(signer.keplr.defaultOptions);
      signer.keplr.defaultOptions = {...defaultOptions, sign: { disableBalanceCheck: true }}
    }
    try {
      return await signAndBroadcast(address, msgs, gas, memo, gasPrice)
    } finally {
      if(defaultOptions){
        signer.keplr.defaultOptions = defaultOptions
      }
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
    return pollForTx(result.transactionHash).then(
      (value) => {
        clearTimeout(txPollTimeout);
        assertIsDeliverTxSuccess(value)
        return value
      },
      (error) => {
        clearTimeout(txPollTimeout);
        return error
      },
    )
  }

  async function sign(address, messages, memo, fee){
    const account = await getAccount(address)
    const { account_number: accountNumber, sequence } = account
    const txBodyBytes = makeBodyBytes(messages, memo)
    let aminoMsgs
    try {
      aminoMsgs = convertToAmino(messages)
    } catch (e) { }
    if(aminoMsgs && signer.signAmino){
      // Sign as amino if possible for Ledger and Keplr support
      const signDoc = makeAminoSignDoc(aminoMsgs, fee, chainId, memo, accountNumber, sequence);
      const { signature, signed } = await signer.signAmino(address, signDoc);
      const authInfoBytes = await makeAuthInfoBytes(account, {
        amount: signed.fee.amount,
        gasLimit: signed.fee.gas,
      }, SignMode.SIGN_MODE_LEGACY_AMINO_JSON)
      return {
        bodyBytes: makeBodyBytes(messages, signed.memo),
        authInfoBytes: authInfoBytes,
        signatures: [Buffer.from(signature.signature, "base64")],
      }
    }else{
      // Sign using standard protobuf messages
      const authInfoBytes = await makeAuthInfoBytes(account, {
        amount: fee.amount,
        gasLimit: fee.gas,
      }, SignMode.SIGN_MODE_DIRECT)
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
    const fee = getFee(100_000)
    const txBody = {
      bodyBytes: makeBodyBytes(messages, memo),
      authInfoBytes: await makeAuthInfoBytes(account, {
        amount: fee.amount,
        gasLimit: fee.gas,
      }, SignMode.SIGN_MODE_UNSPECIFIED),
      signatures: [new Uint8Array()],
    }

    try {
      const estimate = await axios.post(restUrl + '/cosmos/tx/v1beta1/simulate', {
        tx_bytes: toBase64(TxRaw.encode(txBody).finish()),
      }).then(el => el.data.gas_info.gas_used)
      return (parseInt(estimate * (modifier || defaultGasModifier)));
    } catch (error) {
      throw new Error(error.response?.data?.message || error.message)
    }
  }

  function convertToAmino(messages){
    return messages.map(message => {
      if(message.typeUrl.startsWith('/cosmos.authz') && !network.authzAminoSupport){
        throw new Error('This chain does not support amino conversion for Authz messages')
      }
      if(message.typeUrl === '/cosmos.authz.v1beta1.MsgExec' && network.path === 'osmosis'){
        // Osmosis MsgExec gov is broken with Amino currently
        // See https://github.com/osmosis-labs/cosmos-sdk/pull/342
        if(message.value.msgs.some(msg => msg.typeUrl.startsWith('/cosmos.gov'))){
          throw new Error('Osmosis does not support amino conversion for Authz Exec gov messages')
        }
      }
      return aminoTypes.toAmino(message)
    })
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
    signer,
    registry,
    getFee,
    simulate,
    signAndBroadcast,
    signAndBroadcastWithoutBalanceCheck
  };
}

export default SigningClient;
