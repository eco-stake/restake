import { findAsync } from "./Helpers.mjs";
import axios from "axios";
import {
  setupStakingExtension,
  QueryClient,
  setupBankExtension,
  setupDistributionExtension,
} from "@cosmjs/stargate";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";

const RestClient = async (chainId, rpcUrls, restUrls) => {
  // Find available rpcUrl
  const rpcUrl = await findAvailableRpcUrl(
    Array.isArray(rpcUrls) ? rpcUrls : [rpcUrls]
  );

  // Find available restUrl
  const restUrl = await findAvailableRestUrl(
    Array.isArray(restUrls) ? restUrls : [restUrls]
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
    const client = await makeClient();
    return (await client?.staking.validators("BOND_STATUS_BONDED")).validators;
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

  function findAvailableRpcUrl(urls) {
    return findAsync(urls, async (url) => {
      try {
        const res = await axios.get(url + "/status?", { timeout: 1000 });
        const data = res.data;
        return data.result.node_info.network === chainId;
      } catch (error) {
        return false;
      }
    });
  }

  function findAvailableRestUrl(urls) {
    return findAsync(urls, async (url) => {
      try {
        const res = await axios.get(url + "/node_info", { timeout: 2000 });
        const data = res.data;
        return data.node_info.network === chainId;
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
