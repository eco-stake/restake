import axios from 'axios'
import _ from 'lodash'
import { findAsync } from './Helpers.mjs'
import {
  setupStakingExtension,
  QueryClient,
  setupBankExtension,
  setupDistributionExtension,
  setupMintExtension,
  setupGovExtension,
} from "@cosmjs/stargate";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";

const RestClient = async (chainId, restUrls,rpcUrls) => {
  // Find available rpcUrl
  const rpcUrl = await findAvailableUrl(
    Array.isArray(rpcUrls) ? rpcUrls : [rpcUrls],
    "rpc"
  );

  // Find available restUrl
  const restUrl = await findAvailableUrl(
    Array.isArray(restUrls) ? restUrls : [restUrls],
    "rest"
  );

  /**
   * Make Client
   *
   * @returns QueryClient with necessary extensions
   */
  const makeClient = async () => {
    const tmClient = await Tendermint34Client.connect(rpcUrl);
    return QueryClient.withExtensions(
      tmClient,
      setupStakingExtension,
      setupBankExtension,
      setupDistributionExtension,
      setupMintExtension,
      setupGovExtension
    );
  };

  const getAllValidators = async () => {
    // Create queryClient
    const client = await makeClient();

    // Validators
    const allValidators = [];

    // Loop through pagination
    let startAtKey;
    do {
      const response = await client?.staking.validators(
        "BOND_STATUS_BONDED",
        startAtKey
      );
      const { validators, pagination } = response;
      const loadedValidators = validators || [];
      loadedValidators.reverse();
      allValidators.unshift(...loadedValidators);
      startAtKey = pagination?.nextKey;
    } while (startAtKey?.length !== 0);
    const validators = _.shuffle(allValidators);

    // Return shuffled array
    return validators.reduce((a, v) => ({ ...a, [v.operatorAddress]: v}), {})
  };

  const getAllValidatorDelegations = async (validatorAddress) => {
    // Create queryClient
    const client = await makeClient();

    // ValidatorDelegations
    const allValidatorDelegations = [];

    // Loop through pagination
    let startAtKey;
    do {
      const response = await client?.staking.validatorDelegations(
        validatorAddress,
        startAtKey
      );
      const { validatorDelegations, pagination } = response;
      const loadedValidatorDelegations = validatorDelegations || [];
      loadedValidatorDelegations.reverse();
      allValidatorDelegations.unshift(...loadedValidatorDelegations);
      startAtKey = pagination?.nextKey;
    } while (startAtKey?.length !== 0);

    return allValidatorDelegations;
  };

  const getDelegations = async (address) => {
    // Create queryClient
    const client = await makeClient();

    // DelegatorDelegations
    const allDelegatorDelegations = [];

    // Loop through pagination
    let startAtKey;
    do {
      const response = await client?.staking.delegatorDelegations(
        address,
        startAtKey
      );
      const { delegatorDelegations, pagination } = response;
      const loadedDelegatorDelegations = delegatorDelegations || [];
      loadedDelegatorDelegations.reverse();
      allDelegatorDelegations.unshift(...loadedDelegatorDelegations);
      startAtKey = pagination?.nextKey;
    } while (startAtKey?.length !== 0);

    return allDelegatorDelegations;
  };

  const getBalance = async (address, denom) => {
    const client = await makeClient();
    return await client?.bank.balance(address, denom);
  };

  const getRewards = async (address) => {
    const client = await makeClient();
    return await (client?.distribution.delegationTotalRewards(address)).rewards;
  };

  /**
   * @TODO Since authz features are not implemented in queryClient yet, we need to leave this like it is.
   * See https://github.com/cosmos/cosmjs/issues/1080 for further details.
   */
  const getGrants = async (botAddress, address) => {
    const searchParams = new URLSearchParams();
    searchParams.append("grantee", botAddress);
    searchParams.append("granter", address);
    // searchParams.append("msg_type_url", "/cosmos.staking.v1beta1.MsgDelegate");
    const res = await axios.get(
      restUrl + "/cosmos/authz/v1beta1/grants?" + searchParams.toString()
    );
    const result_1 = res.data;
    const claimGrant = result_1.grants.find((el) => {
      if (
        el.authorization["@type"] ===
          "/cosmos.authz.v1beta1.GenericAuthorization" &&
        el.authorization.msg ===
          "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
      ) {
        return Date.parse(el.expiration) > new Date();
      } else {
        return false;
      }
    });
    const stakeGrant = result_1.grants.find((el_1) => {
      if (
        el_1.authorization["@type"] ===
        "/cosmos.staking.v1beta1.StakeAuthorization"
      ) {
        return Date.parse(el_1.expiration) > new Date();
      } else {
        return false;
      }
    });
    return {
      claimGrant,
      stakeGrant,
    };
  };


  const getBlocksPerYear = async () => { 
    const client = await makeClient();
    const params = await client.mint.params();
    return params.blocksPerYear.toInt();
  }

  const getInflation = async () => { 
    const client = await makeClient();
    const inflation = await client.mint.inflation();
    console.log(inflation.toFloatApproximation());
    return inflation.toFloatApproximation();
  }




  function findAvailableUrl(urls, urlType) {
    const urlParam = urlType === "rpc" ? "/status?" : "/node_info";
    return findAsync(urls, async (url) => {
      try {
        const res = await axios.get(url + urlParam, { timeout: 1000 });
        const nodeInfo = res.data.result
          ? res.data.result.node_info
          : res.data.node_info;
        return nodeInfo.network === chainId;
      } catch (error) {
        return false;
      }
    });
  }

  return {
    connected: !!restUrl,
    restUrl,
    getAllValidators,
    getAllValidatorDelegations,
    getBlocksPerYear,
    getInflation,
    getBalance,
    getDelegations,
    getRewards,
    getGrants,
  };
};

export default RestClient;