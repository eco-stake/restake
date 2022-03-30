import fs from 'fs'
import _ from 'lodash'
import Network from '../src/utils/Network.mjs'
import { executeSync } from '../src/utils/Helpers.mjs'

async function checkAuthz(networkName) {
  const networksData = fs.readFileSync('src/networks.json');
  const networks = JSON.parse(networksData);
  const calls = networks.map(data => {
    return async () => {
      if(networkName && data.name !== networkName) return
      try {
        const network = await Network(data)
        const support = await testAuthz(network)
        if (data.authzSupport !== support){
          console.log(network.name, 'support is different', support ? 'ENABLED' : 'DISABLED')
        }
      } catch (error) {
        console.log(data.name, error.message)
      }
    }
  })
  await executeSync(calls, 5)
}
async function testAuthz(network) {
  return network.queryClient
    .getGrants()
    .then(
      (result) => { },
      (error) => {
        if (error.response && error.response.status === 501) {
          return false
        }
        return true
      }
    );
}

const networkName = process.argv[2]
checkAuthz(networkName)