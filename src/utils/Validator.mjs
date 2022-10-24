import { Bech32 } from '@cosmjs/encoding'

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

  function isValidatorOperator(address) {
    if (!address || !window.atob) return false;

    const prefix = network.prefix
    const validatorOperator = Bech32.encode(prefix, Bech32.decode(data.operator_address).data)
    return validatorOperator === address
  }

  return {
    ...data,
    address,
    totalTokens,
    totalUsd,
    totalUsers,
    totalSlashes,
    uptime,
    missedBlocks,
    isValidatorOperator
  }
}

export default Validator;
