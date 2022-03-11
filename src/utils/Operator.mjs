// import axios from 'axios'

const Operator = (data, validatorData) => ({
  address: data.address,
  botAddress: data.botAddress,
  moniker: validatorData && validatorData.description.moniker,
  description: validatorData && validatorData.description,
  validatorData,
  data,
});

export default Operator;
