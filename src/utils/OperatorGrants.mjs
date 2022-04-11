const OperatorGrants = (grants) => {
  let grantValidators, maxTokens;

  const claimGrant = grants.find((el) => {
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
  const stakeGrant = grants.find((el) => {
    if (
      el.authorization["@type"] ===
      "/cosmos.staking.v1beta1.StakeAuthorization" || (
        // Handle GenericAuthorization for Ledger
        el.authorization["@type"] ===
        "/cosmos.authz.v1beta1.GenericAuthorization" &&
        el.authorization.msg ===
        "/cosmos.staking.v1beta1.MsgDelegate"
      )
    ) {
      return Date.parse(el.expiration) > new Date();
    } else {
      return false;
    }
  })

  if (stakeGrant) {
    grantValidators =
      stakeGrant.authorization.allow_list?.address;
    maxTokens = stakeGrant.authorization.max_tokens
  }

  return {
    claimGrant,
    stakeGrant,
    validators: grantValidators || [],
    maxTokens: maxTokens && bignumber(maxTokens.amount),
    grantsValid: !!(
      claimGrant && stakeGrant &&
      (!validators || validators.includes(operator.address)) &&
      (maxTokens === null || larger(maxTokens, this.validatorReward(operator.address)))
    ),
    grantsExist: !!(claimGrant || stakeGrant),
  }
}

export default OperatorGrants;

