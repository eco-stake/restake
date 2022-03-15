import axios from "axios";
import _ from "lodash";

const QueryClient = async (chainId, rpcUrls, restUrls) => {
  const rpcUrl = await findAvailableUrl(
    Array.isArray(rpcUrls) ? rpcUrls : [rpcUrls],
    "rpc"
  );
  const restUrl = await findAvailableUrl(
    Array.isArray(restUrls) ? restUrls : [restUrls],
    "rest"
  );

  function parseCommissionRate(validator) {
    return (
      parseInt(validator.commission.commissionRates.rate) / 1000000000000000000
    );
  }

  const getValidators = (pageSize, nextKey) => {
    const searchParams = new URLSearchParams();
    searchParams.append("status", "BOND_STATUS_BONDED");
    if (pageSize) searchParams.append("pagination.limit", pageSize);
    if (nextKey) searchParams.append("pagination.key", nextKey);
    return axios
      .get(
        restUrl +
          "/cosmos/staking/v1beta1/validators?" +
          searchParams.toString(),
        {
          timeout: 5000,
        }
      )
      .then((res) => res.data);
  };

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

  const getBalance = async (address) => {
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

  const getChainApr = async () => {
    const client = await makeClient();
    const pool = await client.staking.pool();
    const supply = await client.bank.supplyOf(denom);
    const bondedTokens = pool.pool.bondedTokens;
    const totalSupply = supply.amount;
    if (chainId.startsWith("osmosis")) {
      const apr = await osmosisApr(totalSupply, bondedTokens);
      return apr;
    } else if (chainId.startsWith("sifchain")) {
      const aprRequest = await axios.get(
        "https://data.sifchain.finance/beta/validator/stakingRewards"
      );
      const apr = aprRequest.data.rate;
      return apr;
    } else {
      const req = await client.mint.inflation();
      const baseInflation = req.toFloatApproximation();
      const ratio = bondedTokens / totalSupply;
      const apr = baseInflation / ratio;
      return apr;
    }
  };

  const osmosisApr = async (totalSupply, bondedTokens) => {
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
    const baseInflation = yearMintingProvision / totalSupply;
    const bondedRatio = bondedTokens / totalSupply;
    const apr = baseInflation / bondedRatio;
    return apr;
  };

  const getApy = async (validators) => {
    const periodPerYear = 365;
    const chainApr = await getChainApr();
    let validatorApy = {};
    for (const [address, validator] of Object.entries(validators)) {
      const realApr = chainApr * (1 - parseCommissionRate(validator));
      const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
      validatorApy[address] = apy;
    }
    return validatorApy;
  };

  function findAvailableUrl(urls, type) {
    const path = type === "rest" ? "/blocks/latest" : "/block";
    return Promise.any(
      urls.map((url) => {
        return axios
          .get(url + path, { timeout: 10000 })
          .then((res) => res.data)
          .then((data) => {
            if (type === "rpc") data = data.result;
            if (!data.block.header.chain_id === chainId) {
              throw false;
            }
            return url;
          });
      })
    );
  }

  return {
    connected: !!rpcUrl && !!restUrl,
    rpcUrl,
    restUrl,
    getApy,
    getAllValidators,
    getAllValidatorDelegations,
    getInflation,
    getBalance,
    getDelegations,
    getRewards,
    getGrants,
  };
};

export default QueryClient;
