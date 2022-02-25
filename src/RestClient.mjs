import axios from 'axios'

const RestClient = (restUrl) => {
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

  const getBalance = (address) => {
    return axios.get(restUrl + "/cosmos/bank/v1beta1/balances/" + address)
      .then(res => res.data)
      .then(
        (result) => {
          const balance = result.balances.find(element => element.denom === 'uosmo') || {denom: 'uosmo', amount: 0}
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
    if(maxSize) searchParams.append("pagination.limit", maxSize)

    return axios.get(restUrl + "/cosmos/staking/v1beta1/validators/" + validatorAddress + "/delegations?" + searchParams.toString())
      .then(res => res.data)
      .then(
        (result) => {
          return result.delegation_responses
        }
      )
  }

  return {
    getValidators,
    getBalance,
    getDelegations,
    getRewards,
    getGrants,
    getValidatorDelegations
  }
}

export default RestClient;
