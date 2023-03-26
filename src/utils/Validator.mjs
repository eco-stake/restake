import Bech32 from "bech32";

const Validator = (network, data) => {
  const address = data.operator_address
  const { delegations } = data
  const totalSlashes = data.slashes?.length
  const blockPeriod = data.missed_blocks_periods && data.missed_blocks_periods.slice(-1)[0]
  const uptime = blockPeriod?.blocks && ((blockPeriod.blocks - blockPeriod.missed) / blockPeriod.blocks)
  const missedBlocks = blockPeriod?.missed
  const totalTokens = delegations?.total_tokens_display
  const totalUsd = delegations?.total_usd
  const totalUsers = delegations?.total_count
  const commissionRate = data.commission.commission_rates.rate

  function isValidatorOperator(address) {
    if (!address || !window.atob) return false;

    const prefix = network.prefix
    const validatorOperator = Bech32.encode(prefix, Bech32.decode(data.operator_address).data)
    return validatorOperator === address
  }

  function getAPR(){
    if (!data.active) {
      return 0
    } else {
      return network.chain.estimatedApr * (1 - commissionRate);
    }
  }

  function getAPY(operator){
    const apr = getAPR()
    if(!apr) return 0

    const periodPerYear = operator && network.chain.authzSupport ? operator.runsPerDay(network.data.maxPerDay) * 365 : 1;
    return (1 + apr / periodPerYear) ** periodPerYear - 1;
  }

  return {
    ...data,
    address,
    commissionRate,
    totalTokens,
    totalUsd,
    totalUsers,
    totalSlashes,
    uptime,
    missedBlocks,
    isValidatorOperator,
    getAPR,
    getAPY
  }
}

export default Validator;
