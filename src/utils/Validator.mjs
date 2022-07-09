import { Bech32 } from '@cosmjs/encoding'

const Validator = (network, data) => {
  const address = data.operator_address

  function isValidatorOperator(address) {
    if (!address || !window.atob) return false;

    const prefix = network.prefix
    const validatorOperator = Bech32.encode(prefix, Bech32.decode(data.operator_address).data)
    return validatorOperator === address
  }

  return {
    ...data,
    address,
    isValidatorOperator
  }
}

export default Validator;
