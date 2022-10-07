import axios from "axios";
import _ from "lodash";

const QueryClient = async (chainId, restUrls, opts) => {
  const config = _.merge({
    connectTimeout: 10000,
  }, opts)
  const restUrl = await findAvailableUrl(restUrls, "rest", { timeout: config.connectTimeout })

  const getAllValidators = (pageSize, opts, pageCallback) => {
    return getAllPages((nextKey) => {
      return getValidators(pageSize, opts, nextKey);
    }, pageCallback).then((pages) => {
      const validators = _.shuffle(pages.map((el) => el.validators).flat());
      return validators.reduce(
        (a, v) => ({ ...a, [v.operator_address]: v }),
        {}
      );
    });
  };

  const getValidators = (pageSize, opts, nextKey) => {
    opts = opts || {}
    const searchParams = new URLSearchParams();
    if (opts.status) searchParams.append("status", opts.status);
    if (pageSize) searchParams.append("pagination.limit", pageSize);
    if (nextKey) searchParams.append("pagination.key", nextKey);
    return axios
      .get(
        restUrl +
          "/cosmos/staking/v1beta1/validators?" +
          searchParams.toString(),
        {
          timeout: opts.timeout || 10000,
        }
      )
      .then((res) => res.data);
  };

  const getAllValidatorDelegations = (
    validatorAddress,
    pageSize,
    opts,
    pageCallback
  ) => {
    return getAllPages((nextKey) => {
      return getValidatorDelegations(validatorAddress, pageSize, opts, nextKey);
    }, pageCallback).then((pages) => {
      return pages.map((el) => el.delegation_responses).flat();
    });
  };

  const getValidatorDelegations = (validatorAddress, pageSize, opts, nextKey) => {
    const searchParams = new URLSearchParams();
    if (pageSize) searchParams.append("pagination.limit", pageSize);
    if (nextKey) searchParams.append("pagination.key", nextKey);

    return axios
      .get(
        restUrl +
          "/cosmos/staking/v1beta1/validators/" +
          validatorAddress +
          "/delegations?" +
          searchParams.toString(),
          opts
      )
      .then((res) => res.data);
  };

  const getBalance = (address, denom, opts) => {
    return axios
      .get(restUrl + "/cosmos/bank/v1beta1/balances/" + address, opts)
      .then((res) => res.data)
      .then((result) => {
        const balance = result.balances?.find(
          (element) => element.denom === denom
        ) || { denom: denom, amount: 0 };
        return balance;
      });
  };

  const getDelegations = (address) => {
    return axios
      .get(restUrl + "/cosmos/staking/v1beta1/delegations/" + address)
      .then((res) => res.data)
      .then((result) => {
        const delegations = result.delegation_responses.reduce(
          (a, v) => ({ ...a, [v.delegation.validator_address]: v }),
          {}
        );
        return delegations;
      });
  };

  const getRewards = (address, opts) => {
    return axios
      .get(`${restUrl}/cosmos/distribution/v1beta1/delegators/${address}/rewards`, opts)
      .then((res) => res.data)
      .then((result) => {
        const rewards = result.rewards.reduce(
          (a, v) => ({ ...a, [v.validator_address]: v }),
          {}
        );
        return rewards;
      });
  };

  const getCommission = (validatorAddress, opts) => {
    return axios
      .get(`${restUrl}/cosmos/distribution/v1beta1/validators/${validatorAddress}/commission`, opts)
      .then((res) => res.data)
      .then((result) => {
        return result.commission
      });
  };

  const getProposals = (opts) => {
    const { pageSize } = opts || {}
    return getAllPages((nextKey) => {
      const searchParams = new URLSearchParams();
      searchParams.append("pagination.limit", pageSize || 100);
      if (nextKey) searchParams.append("pagination.key", nextKey);

      return axios
        .get(restUrl + "/cosmos/gov/v1beta1/proposals?" +
          searchParams.toString(), opts)
        .then((res) => res.data)
    }).then((pages) => {
      return pages.map(el => el.proposals).flat();
    });
  };

  const getProposalTally = (proposal_id, opts) => {
    return axios
      .get(restUrl + "/cosmos/gov/v1beta1/proposals/" + proposal_id + '/tally', opts)
      .then((res) => res.data)
  };

  const getProposalVote = (proposal_id, address, opts) => {
    return axios
      .get(restUrl + "/cosmos/gov/v1beta1/proposals/" + proposal_id + '/votes/' + address, opts)
      .then((res) => res.data)
  };

  const getGranteeGrants = (grantee, opts, pageCallback) => {
    const { pageSize } = opts || {}
    return getAllPages((nextKey) => {
      const searchParams = new URLSearchParams();
      searchParams.append("pagination.limit", pageSize || 100);
      if (nextKey) searchParams.append("pagination.key", nextKey);

      return axios
        .get(restUrl + "/cosmos/authz/v1beta1/grants/grantee/" + grantee + "?" +
          searchParams.toString(), opts)
        .then((res) => res.data)
    }, pageCallback).then((pages) => {
      return pages.map(el => el.grants).flat();
    });
  };

  const getGranterGrants = (granter, opts, pageCallback) => {
    const { pageSize } = opts || {}
    return getAllPages((nextKey) => {
      const searchParams = new URLSearchParams();
      searchParams.append("pagination.limit", pageSize || 100);
      if (nextKey) searchParams.append("pagination.key", nextKey);

      return axios
        .get(restUrl + "/cosmos/authz/v1beta1/grants/granter/" + granter + "?" +
          searchParams.toString(), opts)
        .then((res) => res.data)
    }, pageCallback).then((pages) => {
      return pages.map(el => el.grants).flat();
    });
  };

  const getGrants = (grantee, granter, opts) => {
    const searchParams = new URLSearchParams();
    if(grantee) searchParams.append("grantee", grantee);
    if(granter) searchParams.append("granter", granter);
    return axios
      .get(restUrl + "/cosmos/authz/v1beta1/grants?" + searchParams.toString(), opts)
      .then((res) => res.data)
      .then((result) => {
        return result.grants
      });
  };

  const getWithdrawAddress = (address, opts) => {
    return axios
      .get(
        restUrl +
          "/cosmos/distribution/v1beta1/delegators/" +
          address +
          "/withdraw_address", opts
      )
      .then((res) => res.data)
      .then((result) => {
        return result.withdraw_address
      });
  };

  const getAllPages = async (getPage, pageCallback) => {
    let pages = [];
    let nextKey, error;
    do {
      const result = await getPage(nextKey);
      pages.push(result);
      nextKey = result.pagination?.next_key;
      if (pageCallback) await pageCallback(pages);
    } while (nextKey);
    return pages;
  };

  async function findAvailableUrl(urls, type, opts) {
    if(!urls) return

    if (!Array.isArray(urls)) {
      if (urls.match('cosmos.directory')) {
        return urls // cosmos.directory health checks already
      } else {
        urls = [urls]
      }
    }
    const path = type === "rest" ? "/cosmos/base/tendermint/v1beta1/blocks/latest" : "/block";
    return Promise.any(urls.map(async (url) => {
      url = url.replace(/\/$/, '')
      try {
        let data = await getLatestBlock(url, type, path, opts)
        if (type === "rpc") data = data.result;
        if (data.block?.header?.chain_id === chainId) {
          return url;
        }
      } catch { }
    }));
  }

  async function getLatestBlock(url, type, path, opts){
    const { timeout } = opts || {}
    try {
      return await axios.get(url + path, { timeout })
        .then((res) => res.data)
    } catch (error) {
      const fallback = type === 'rest' && '/blocks/latest'
      if (fallback && fallback !== path && error.response?.status === 501) {
        return getLatestBlock(url, type, fallback, opts)
      }
      throw(error)
    }
  }

  return {
    connected: !!restUrl,
    restUrl,
    getAllValidators,
    getValidators,
    getAllValidatorDelegations,
    getValidatorDelegations,
    getBalance,
    getDelegations,
    getRewards,
    getCommission,
    getProposals,
    getProposalTally,
    getProposalVote,
    getGrants,
    getGranteeGrants,
    getGranterGrants,
    getWithdrawAddress
  };
};

export default QueryClient;
