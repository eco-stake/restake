import axios from 'axios'
import {findAsync} from './Helpers.mjs'

const RestClient = async (chainId, restUrls) => {

  const restUrl = await findAvailableUrl(Array.isArray(restUrls) ? restUrls : [restUrls])

  const getValidators = () => {
    return axios.get(restUrl + "/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=500")
      .then(res => res.data)
      .then(
        (result) => {
          const validators = result.validators.reduce((a, v) => ({ ...a, [v.operator_address]: v}), {})
          return validators
        }
      )
  }

  const getBalance = (address, denom) => {
    return axios.get(restUrl + "/cosmos/bank/v1beta1/balances/" + address)
      .then(res => res.data)
      .then(
        (result) => {
          const balance = result.balances.find(element => element.denom === denom) || {denom: denom, amount: 0}
          return balance
        }
      )
  }

  const getDelegations = (address) => {
    return axios.get(restUrl + "/cosmos/staking/v1beta1/delegations/" + address)
      .then(res => res.data)
      .then(
        (result) => {
          const delegations = result.delegation_responses.reduce((a, v) => ({ ...a, [v.delegation.validator_address]: v}), {})
          return delegations
        }
      )
  }

  const getRewards = (address) => {
    return axios.get(restUrl + "/cosmos/distribution/v1beta1/delegators/" + address + "/rewards")
      .then(res => res.data)
      .then(
        (result) => {
          const rewards = result.rewards.reduce((a, v) => ({ ...a, [v.validator_address]: v}), {})
          return rewards
        }
      )
  }

  const getGrants = (botAddress, address) => {
    const searchParams = new URLSearchParams();
    searchParams.append("grantee", botAddress);
    searchParams.append("granter", address);
    // searchParams.append("msg_type_url", "/cosmos.staking.v1beta1.MsgDelegate");
    return axios.get(restUrl + "/cosmos/authz/v1beta1/grants?" + searchParams.toString())
      .then(res => res.data)
      .then(
        (result) => {
          const claimGrant = result.grants.find(el => {
            if (el.authorization['@type'] === "/cosmos.authz.v1beta1.GenericAuthorization" &&
              el.authorization.msg === "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"){
              return Date.parse(el.expiration) > new Date()
            }else{
              return false
            }
          })
          const stakeGrant = result.grants.find(el => {
            if(el.authorization['@type'] === "/cosmos.staking.v1beta1.StakeAuthorization"){
              return Date.parse(el.expiration) > new Date()
            }else{
              return false
            }
          })
          return {
            claimGrant,
            stakeGrant
          }
        }
      )
  }

  const getValidatorDelegations = (validatorAddress, maxSize) => {
    const searchParams = new URLSearchParams()
    searchParams.append("pagination.count_total", true)
    if(maxSize) searchParams.append("pagination.limit", maxSize)
    const delegation_responses = [];
    try {
        const response = await axios.get(restUrl + "/cosmos/staking/v1beta1/validators/" + validatorAddress + "/delegations?" + searchParams.toString());
        const totalTrips = response.pagination.total;
        const totalPages = Math.ceil(totalTrips / maxSize);
        const promiseArray = [];
        for (let i = 0; i < (totalPages + 1); i++) {
            promiseArray.push(axios.get(restUrl + "/cosmos/staking/v1beta1/validators/" + validatorAddress + "/delegations?" + searchParams.toString() + "&page=${i}"));
        };

        // promise.all allows you to make multiple axios requests at the same time.
        // It returns an array of the results of all your axios requests
        let resolvedPromises = await Promise.all(promiseArray)
        for (let i = 0; i < resolvedPromises.length; i++) {
            // This will give you access to the output of each API call
            delegation_responses.push(resolvedPromises[i].data.delegation_responses)
        }
      }catch (err) {
        console.log('Something went wrong.');
      }  
    return result.delegation_responses
  }

  function findAvailableUrl(urls){
    return findAsync(urls, (url) => {
      return axios.get(url + '/node_info', {timeout: 2000})
        .then(res => res.data)
        .then(data => {
          return data.node_info.network === chainId
        }).catch(error => {
          return false
        })
    })
  }

  return {
    connected: !!restUrl,
    restUrl,
    getValidators,
    getBalance,
    getDelegations,
    getRewards,
    getGrants,
    getValidatorDelegations
  }
}

export default RestClient;
