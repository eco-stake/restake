<<<<<<< HEAD
import _ from "lodash";
import RestClient from "./RestClient.mjs";
import SigningClient from "./SigningClient.mjs";
import Operator from "./Operator.mjs";

const Network = async (data) => {
  const restClient = await RestClient(data);

  const signingClient = (wallet, key) => {
    const gasPrice = data.gasPrice || "0.0025" + data.denom;
    return SigningClient(data.rpcUrl, data.chainId, gasPrice, wallet, key);
  };
=======
import _ from 'lodash'
import QueryClient from './QueryClient.mjs'
import SigningClient from './SigningClient.mjs'
import Operator from './Operator.mjs'
import Chain from './Chain.mjs'

const Network = async (data, withoutQueryClient) => {

  const chain = await Chain(data)
  let queryClient
  if(!withoutQueryClient){
    queryClient = await QueryClient(chain.chainId, data.rpcUrl, data.restUrl)
  }

  const signingClient = (wallet, key) => {
    if(!queryClient) return 

    const gasPrice = data.gasPrice || '0.0025' + chain.denom
    return SigningClient(queryClient.rpcUrl, chain.chainId, gasPrice, wallet, key)
  }
>>>>>>> upstream/master

  const getOperator = (operators, operatorAddress) => {
    return operators.find((elem) => elem.address === operatorAddress);
  };

  const getOperatorByBotAddress = (operators, botAddress) => {
    return operators.find(elem => elem.botAddress === botAddress)
  }

  const getOperators = (validators) => {
    return sortOperators().map((operator) => {
      const validator = validators[operator.address];
      return Operator(operator, validator);
    });
  };

  const sortOperators = () => {
    const random = _.shuffle(data.operators);
    if (data.ownerAddress) {
      return _.sortBy(random, ({ address }) =>
        address === data.ownerAddress ? 0 : 1
      );
    }
    return random;
  };

  const getValidators = () => {
<<<<<<< HEAD
    return restClient.getAllValidators(150);
  };
=======
    return queryClient.getAllValidators(150)
  }
>>>>>>> upstream/master

  return {
    connected: queryClient && queryClient.connected,
    name: data.name,
    prettyName: chain.prettyName,
    chainId: chain.chainId,
    prefix: chain.prefix,
    slip44: chain.slip44,
    gasPrice: data.gasPrice,
    denom: chain.denom,
    symbol: chain.symbol,
    decimals: chain.decimals,
    image: chain.image,
    coinGeckoId: chain.coinGeckoId,
    testAddress: data.testAddress,
    restUrl: queryClient && queryClient.restUrl,
    rpcUrl: queryClient && queryClient.rpcUrl,
    operators: data.operators,
    authzSupport: data.authzSupport,
    data,
    chain,
    queryClient,
    signingClient,
    getValidators,
    getOperators,
    getOperator,
<<<<<<< HEAD
  };
};
=======
    getOperatorByBotAddress
  }
}
>>>>>>> upstream/master

export default Network;
