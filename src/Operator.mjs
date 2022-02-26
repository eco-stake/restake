// import axios from 'axios'

const Operator = (data, validatorData) => {

  return {
    address: data.address,
    botAddress: data.botAddress,
    moniker: validatorData && validatorData.description.moniker,
    description: validatorData && validatorData.description,
    validatorData: validatorData,
    data: data
  }
}

export default Operator;
