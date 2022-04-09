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
  return networks.map(network => {
    let override = overrides[network.name]
    if(!override) return network
    override.overriden = true
    return _.mergeWith(network, override, (a, b) =>
      _.isArray(b) ? b : undefined
    );
  })
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

export async function mapSync(calls, count, batchCallback){
  const batchCalls = _.chunk(calls, count);
  let results = []
  let index = 0
  for (const batchCall of batchCalls) {
    const batchResults =  await mapAsync(batchCall, call => call())
    results.push(batchResults)
    if(batchCallback) batchCallback(batchResults, index)
    index++
  }
  return results.flat()
}

export async function executeSync(calls, count){
  const batchCalls = _.chunk(calls, count);
  for (const batchCall of batchCalls) {
    await mapAsync(batchCall, call => call())
  }
}
