import _ from 'lodash'
import { format, floor } from 'mathjs'
import { coin as _coin } from  '@cosmjs/stargate'

export function timeStamp(...args) {
  console.log('[' + new Date().toISOString().substring(11, 23) + ']', ...args);
}

export function coin(amount, denom){
  return _coin(format(floor(amount), {notation: 'fixed'}), denom)
}

export function overrideNetworks(networks, overrides){
  networks = networks.reduce((a, v) => ({ ...a, [v.name]: v }), {})
  const names = [...Object.keys(networks), ...Object.keys(overrides)]
  return _.uniq(names).sort().map(name => {
    let network = networks[name]
    let override = overrides[name]
    if(!network || !network.name) network = { name, ...network }
    if(!override) return network
    override.overriden = true
    return _.mergeWith(network, override, (a, b) =>
      _.isArray(b) ? b : undefined
    );
  })
}

export function buildExecMessage(grantee, messages) {
  return {
    typeUrl: "/cosmos.authz.v1beta1.MsgExec",
    value: {
      grantee: grantee,
      msgs: messages
    }
  }
}

export function buildExecableMessage(type, typeUrl, value, shouldExec){
  if (shouldExec) {
    return {
      typeUrl: typeUrl,
      value: type.encode(type.fromPartial(value)).finish()
    }
  } else {
    return {
      typeUrl: typeUrl,
      value: value
    }
  }
}

export function parseGrants(grants, grantee, granter) {
  // claimGrant is removed but we track for now to allow revoke
  const claimGrant = grants.find((el) => {
    if (
      (!el.grantee || el.grantee === grantee) && 
      (!el.granter || el.granter === granter) &&
      (el.authorization["@type"] ===
      "/cosmos.authz.v1beta1.GenericAuthorization" &&
      el.authorization.msg ===
      "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward")
    ) {
      return Date.parse(el.expiration) > new Date();
    } else {
      return false;
    }
  });
  const stakeGrant = grants.find((el) => {
    if (
      (!el.grantee || el.grantee === grantee) && 
      (!el.granter || el.granter === granter) &&
      (el.authorization["@type"] ===
      "/cosmos.staking.v1beta1.StakeAuthorization" || (
        // Handle GenericAuthorization for Ledger
        el.authorization["@type"] ===
        "/cosmos.authz.v1beta1.GenericAuthorization" &&
        el.authorization.msg ===
        "/cosmos.staking.v1beta1.MsgDelegate"
      ))
    ) {
      return Date.parse(el.expiration) > new Date();
    } else {
      return false;
    }
  })
  return {
    claimGrant,
    stakeGrant,
  };
}

export function mapAsync(array, callbackfn) {
  return Promise.all(array.map(callbackfn));
}

export function findAsync(array, callbackfn) {
  return mapAsync(array, callbackfn).then(findMap => {
    return array.find((value, index) => findMap[index]);
  });
}

export function filterAsync(array, callbackfn) {
  return mapAsync(array, callbackfn).then(filterMap => {
    return array.filter((value, index) => filterMap[index]);
  });
}

export async function mapSync(calls, count, batchCallback) {
  const batchCalls = _.chunk(calls, count);
  let results = []
  let index = 0
  for (const batchCall of batchCalls) {
    const batchResults = await mapAsync(batchCall, call => call())
    results.push(batchResults)
    if (batchCallback) batchCallback(batchResults, index)
    index++
  }
  return results.flat()
}

export async function executeSync(calls, count) {
  const batchCalls = _.chunk(calls, count);
  for (const batchCall of batchCalls) {
    await mapAsync(batchCall, call => call())
  }
}
