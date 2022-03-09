import { findAsync } from "./Helpers.mjs";
import axios from "axios";
import {
  setupStakingExtension,
  QueryClient,
  setupBankExtension,
  setupDistributionExtension,
} from "@cosmjs/stargate";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import _ from 'lodash'


const RestClient = async (chainId, rpcUrls, restUrls) => {
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
      setupDistributionExtension
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
      const response = await client?.staking.validators("BOND_STATUS_BONDED", startAtKey);
      const { validators, pagination } = response;
      const loadedValidators = (validators || []);
      loadedValidators.reverse();
      allValidators.unshift(...loadedValidators);
      startAtKey = pagination?.nextKey;
    } while (startAtKey?.length !== 0);

    // Return shuffled array
    return _.shuffle(allValidators);
  };

  const getAllValidatorDelegations = async (validatorAddress) => {
    const client = await makeClient();
    return (await client?.staking.validatorDelegations(validatorAddress))
      .delegationResponses;
  };

  const getDelegations = async (address) => {
    const client = await makeClient();
    return (await client?.staking.delegatorDelegations(address))
      .delegationResponses;
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

  function findAvailableUrl(urls, urlType) {
    const urlParam = urlType === "rpc" ? "/status?" : "/node_info";
    return findAsync(urls, async (url) => {
      try {
        const res = await axios.get(url + urlParam, { timeout: 1000 });
        const nodeInfo = res.data.result ? res.data.result.node_info : res.data.node_info;
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
    getBalance,
    getDelegations,
    getRewards,
    getGrants,
  };
};

export default RestClient;
