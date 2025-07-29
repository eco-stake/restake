import _ from 'lodash'
import { format, floor, bignumber } from 'mathjs'
import { coin as _coin } from  '@cosmjs/stargate'
import axios from 'axios'
import winston from 'winston'

import { RESTAKE_USER_AGENT } from './constants.mjs'

export function coin(amount, denom){
  return _coin(format(floor(amount), {notation: 'fixed'}), denom)
}

export function joinString(...args){
  return _.compact(args).join(' ')
}

export function rewardAmount(rewards, denom, type){
  if (!rewards)
    return 0;
  type = type || 'reward'
  const reward = rewards && rewards[type]?.find((el) => el.denom === denom);
  return reward ? bignumber(reward.amount) : 0;
}

export function overrideNetworks(networks, overrides){
  networks = networks.reduce((a, v) => ({ ...a, [v.name]: v }), {})
  const names = [...Object.keys(networks), ...Object.keys(overrides)]

  //const names2 = names.filter(name => { return overrides[name]});
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
      if (el.expiration === null) {
        // null expiration is flakey currently
        // sometimes it means it's expired, sometimes no expiration set (infinite grant)
        // we have to treat as invalid until this is resolved
        return false;
      } else if (Date.parse(el.expiration) > new Date()) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  })
  return {
    stakeGrant
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
    if (batchCallback) await batchCallback(batchResults, index)
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

export async function get(url, opts) {
  const headers = opts?.headers ?? {}

  return axios.get(url, {
    ...opts,
    headers: {
      ...headers,
      'User-Agent': RESTAKE_USER_AGENT,
    }
  })
}

export async function post(url, body, opts) {
  const headers = opts?.headers ?? {}

  return axios.post(url, body, {
    ...opts,
    headers: {
      ...headers,
      'User-Agent': RESTAKE_USER_AGENT,
    }
  })
}

export function createLogger(module) {
  return winston.createLogger({
    level: 'debug',
    defaultMeta: { module },
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.prettyPrint(),
      winston.format.timestamp(),
      winston.format.splat(),
      winston.format.printf(({
        timestamp,
        level,
        message,
        label = '',
        ...meta
      }) => {
        const metaFormatted = Object.entries(meta)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ')
        return `[${timestamp}] ${level}: ${message} ${metaFormatted}`
      })
    ),
    transports: [
      new winston.transports.Console()
    ],
  });
}
