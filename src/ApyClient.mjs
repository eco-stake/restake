import axios from "axios";
import {
  setupStakingExtension,
  QueryClient as CosmjsQueryClient,
  setupBankExtension,
  setupDistributionExtension,
  setupMintExtension,
  setupGovExtension,
} from "@cosmjs/stargate";
import { Tendermint34Client } from "@cosmjs/tendermint-rpc";

const ApyClient = (chain, rpcUrl, restUrl) => {
  const { chainId, denom } = chain

  async function getApy(validators, operators) {
    const chainApr = await getChainApr(denom);
    let validatorApy = {};
    for (const [address, validator] of Object.entries(validators)) {
      if(validator.jailed || validator.status !== 'BOND_STATUS_BONDED'){
        validatorApy[address] = 0
      }else{
        const commission = validator.commission.commission_rates.rate
        const operator = operators.find((el) => el.address === address)
        const periodPerYear = operator && chain.authzSupport ? operator.runsPerDay() * 365 : 1;
        const realApr = chainApr * (1 - commission);
        const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
        validatorApy[address] = apy;
      }
    }
    return validatorApy;
  }

  function duration(epochs, epochIdentifier) {
    const epoch = epochs.find((epoch) => epoch.identifier === epochIdentifier);
    if (!epoch) {
      return 0;
    }

    // Actually, the date type of golang protobuf is returned by the unit of seconds.
    return parseInt(epoch.duration.replace("s", ""));
  }

  async function makeClient() {
    const tmClient = await Tendermint34Client.connect(rpcUrl);
    return CosmjsQueryClient.withExtensions(
      tmClient,
      setupStakingExtension,
      setupBankExtension,
      setupDistributionExtension,
      setupMintExtension,
      setupGovExtension
    );
  }

  async function getChainApr(denom) {
    const client = await makeClient();
    const pool = await client.staking.pool();
    const supply = await client.bank.supplyOf(denom);
    const bondedTokens = pool.pool.bondedTokens;
    const totalSupply = supply.amount;
    if (chainId.startsWith("osmosis")) {
      const apr = await osmosisApr(totalSupply, bondedTokens);
      return apr;
    } else if (chainId.startsWith("sifchain")) {
      const aprRequest = await axios.get(
        "https://data.sifchain.finance/beta/validator/stakingRewards"
      );
      const apr = aprRequest.data.rate;
      return apr;
    } else {
      const req = await client.mint.inflation();
      const baseInflation = req.toFloatApproximation();
      const ratio = bondedTokens / totalSupply;
      const apr = baseInflation / ratio;
      return apr;
    }
  }

  async function osmosisApr(totalSupply, bondedTokens) {
    const mintParams = await axios.get(
      restUrl + "/osmosis/mint/v1beta1/params"
    );
    const osmosisEpochs = await axios.get(
      restUrl + "/osmosis/epochs/v1beta1/epochs"
    );
    const epochProvisions = await axios.get(
      restUrl + "/osmosis/mint/v1beta1/epoch_provisions"
    );
    const { params } = mintParams.data;
    const { epochs } = osmosisEpochs.data;
    const { epoch_provisions } = epochProvisions.data;
    const mintingEpochProvision = parseFloat(params.distribution_proportions.staking) * epoch_provisions;
    const epochDuration = duration(epochs, params.epoch_identifier);
    const yearMintingProvision = (mintingEpochProvision * (365 * 24 * 3600)) / epochDuration;
    const baseInflation = yearMintingProvision / totalSupply;
    const bondedRatio = bondedTokens / totalSupply;
    const apr = baseInflation / bondedRatio;
    return apr;
  }

  return {
    getApy
  };
}
export default ApyClient;