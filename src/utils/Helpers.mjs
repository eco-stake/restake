import _ from 'lodash'

export function overrideNetworks(networks, overrides){
  return networks.map(network => {
    let override = overrides[network.name]
    if(!override) return network
    return _.merge(network, override)
  })
}

export function mapAsync(array, callbackfn) {
  return Promise.all(array.map(callbackfn));
}

export async function findAsync(array, callbackfn) {
  const findMap = await mapAsync(array, callbackfn)
  return array.find((value, index) => findMap[index])
}

export async function filterAsync(array, callbackfn) {
  const filterMap = await mapAsync(array, callbackfn)
  return array.filter((value, index) => filterMap[index])
}

export async function executeSync(calls, count){
  const batchCalls = _.chunk(calls, count);
  for (const batchCall of batchCalls) {
    await mapAsync(batchCall, call => call())
  }
}
