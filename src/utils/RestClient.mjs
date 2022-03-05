import axios from 'axios'
import _ from 'lodash'
import {findAsync} from './Helpers.mjs'

const RestClient = async (chainId, restUrls) => {

  const restUrl = await findAvailableUrl(Array.isArray(restUrls) ? restUrls : [restUrls])

  const getValidators = () => {
    return axios.get(restUrl + "/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=500")
      .then(res => res.data)
      .then(
        (result) => {
          const validators = _.shuffle(result.validators).reduce((a, v) => ({ ...a, [v.operator_address]: v}), {})
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
          const delegations = _.shuffle(result.delegation_responses).reduce((a, v) => ({ ...a, [v.delegation.validator_address]: v}), {})
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

  const getAllValidatorDelegations = async (validatorAddress, pageSize, pageCallback) => {
    let batches = []
    let nextKey, error
    do {
      try {
        const result = await getValidatorDelegations(validatorAddress, pageSize, nextKey)
        batches.push(result.delegation_responses)
        nextKey = result.pagination.next_key
        if(pageCallback) pageCallback(batches, result.pagination.total)
      } catch (err) {
        error = err
      }
    } while (nextKey && !error)
    return batches.flat()
  }

  const getValidatorDelegations = (validatorAddress, pageSize, nextKey) => {
    const searchParams = new URLSearchParams()
    if(pageSize) searchParams.append("pagination.limit", pageSize)
    if(nextKey) searchParams.append("pagination.key", nextKey)

    return axios.get(restUrl + "/cosmos/staking/v1beta1/validators/" + validatorAddress + "/delegations?" + searchParams.toString())
      .then(res => res.data)
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
    getAllValidatorDelegations,
    getValidatorDelegations
  }
}

export default RestClient;
