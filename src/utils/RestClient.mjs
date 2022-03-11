import axios from "axios";
import _ from "lodash";
import { findAsync } from "./Helpers.mjs";
import {
  setupStakingExtension,
  QueryClient,
  setupBankExtension,
  setupDistributionExtension,
  setupMintExtension,
  setupGovExtension,
} from "@cosmjs/stargate";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";
import { Decimal } from "@cosmjs/math";

function duration(epochs, epochIdentifier) {
  const epoch = epochs.find((epoch) => epoch.identifier === epochIdentifier);
  if (!epoch) {
    return 0;
  }

  // Actually, the date type of golang protobuf is returned by the unit of seconds.
  return parseInt(epoch.duration.replace("s", ""));
}

const RestClient = async (chainId, restUrls, rpcUrls) => {
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
    return validators.reduce((a, v) => ({ ...a, [v.operatorAddress]: v }), {});
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

  const getInflation = async () => {
    const client = await makeClient();
    const inflation = await client.mint.inflation();
    return inflation.toFloatApproximation();
  };

  const getChainApr = async (denom) => {
    const client = await makeClient();
    const pool = await client.staking.pool();
    const totalSupply = await client.bank.supplyOf(denom);
    console.log("pool", pool, "total supply", totalSupply);
    if (chainId.startsWith("osmosis")) {
      const apr = calcOsmosisApr(totalSupply.amount, pool.bondedTokens);
      console.log(apr);
      return apr;
    } else if (chainId.startWith("sifchain")) {
      // sifchain APR
    } else {
      //other APRS
      const req = await client.mint.inflation();
      const inflation = req.toFloatApproximation();
    }
  };

  const calcOsmosisApr = async (totalSupply, bondedTokens) => {
    const mintParams = await axios.get(
      restUrl + "/osmosis/mint/v1beta1/params"
    );
    const osmosisEpochs = await axios.get(
      restUrl + "/osmosis/epochs/v1beta1/epochs"
    );
    const epochProvisions = await axios.get(
      restUrl + "/osmosis/mint/v1beta1/epoch_provisions"
    );

    const { params } = mintParams.data;
    const { epochs } = osmosisEpochs.data;
    const { epoch_provisions } = epochProvisions.data;

    const mintingEpochProvision =
      parseFloat(params.distribution_proportions.staking) * epoch_provisions;

    const epochDuration = duration(epochs, params.epoch_identifier);
    const yearMintingProvision =
      (mintingEpochProvision * (365 * 24 * 3600)) / epochDuration;

    return yearMintingProvision / totalSupply / (bondedTokens / totalSupply);
  };
  getChainApr("uosmo");

  /*   
  



  const getInflation = async () => {
    if (this.props.network.chainId.startsWith("osmosis")) {
      return this.getOsmosisInflation();
    } else if (this.props.network.chainId.startsWith("sifchain")) {
      let inflation = await axios.get(
        "https://data.sifchain.finance/beta/validator/stakingRewards"
      );
      return inflation.data.rate;
    } else {
      return await this.props.restClient.getInflation();
    }
  };

  const calculateApy = async () => {
    if (this.props.network.chainId.startsWith("juno")) {
      const params = await axios.get(
        this.props.network.restUrl + "/cosmos/mint/v1beta1/params"
      );
    }
    const { validators } = this.props;
    const periodPerYear = 365;
    if (this.props.network.chainId.startsWith("osmosis")) {
      const chainApr = await this.getInflation();
      let validatorApy = {};
      for (const [address, validator] of Object.entries(validators)) {
        const realApr = chainApr * (1 - parseCommissionRate(validator));
        const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
        validatorApy[address] = apy;
      }
      this.setState({ validatorApy });
    } else if (this.props.network.chainId.startsWith("sifchain")) {
      const chainApr = await this.getInflation();
      let validatorApy = {};
      for (const [address, validator] of Object.entries(validators)) {
        const realApr = chainApr * (1 - parseCommissionRate(validator));
        const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
        //console.log(chainApr, realApr, apy);
        validatorApy[address] = apy;
      }
      this.setState({ validatorApy });
    } else {
      const total = await axios.get(
        this.props.network.restUrl + "/bank/total/" + this.props.network.denom
      );
      const pool = await axios.get(
        this.props.network.restUrl + "/cosmos/staking/v1beta1/pool"
      );
      const bondedTokens = parseInt(pool.data.pool.bonded_tokens);
      const totalSupply = parseInt(total.data.result.amount);

      const ratio = bondedTokens / totalSupply;
      const inflation = await this.getInflation();
      const chainApr = inflation / ratio;
      let validatorApy = {};
      for (const [address, validator] of Object.entries(validators)) {
        const realApr = chainApr * (1 - parseCommissionRate(validator));
        const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
        validatorApy[address] = apy;
      }
      this.setState({ validatorApy });
    }
  }; */

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
    getInflation,
    getBalance,
    getDelegations,
    getRewards,
    getGrants,
  };
};
export default RestClient;
