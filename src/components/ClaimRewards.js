import { MsgWithdrawDelegatorReward, MsgWithdrawValidatorCommission } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { coin } from "../utils/Helpers.mjs";

import {
  Dropdown
} from 'react-bootstrap'

import { add, subtract, multiply, divide, bignumber, floor } from 'mathjs'

function ClaimRewards(props) {
  async function claim(){
    props.setLoading(true)

    let signAndBroadcast = props.stargateClient.signAndBroadcast
    const gasSimMessages = buildMessages(props.validatorRewards)

    let gas
    try {
      gas = await props.stargateClient.simulate(props.address, gasSimMessages)
    } catch (error) {
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
      return
    }

    const fee = props.stargateClient.getFee(gas)
    const feeAmount = fee.amount[0].amount

    const totalReward = props.validatorRewards.reduce((sum, validatorReward) => add(sum, bignumber(validatorReward.reward)), 0);
    const adjustedValidatorRewards = props.validatorRewards.map(validatorReward => {
      const shareOfFee = multiply(divide(validatorReward.reward, totalReward), feeAmount); // To take a proportional amount from each validator relative to total reward
      return {
        validatorAddress: validatorReward.validatorAddress,
        reward: subtract(validatorReward.reward, shareOfFee),
      }
    })

    signAndBroadcast = props.stargateClient.signAndBroadcastWithoutBalanceCheck

    if(!props.commission && adjustedValidatorRewards.some(validatorReward => validatorReward.reward <= 0)) {
      props.setLoading(false)
      props.setError('Reward is too low')
      return
    }

    let messages = buildMessages(adjustedValidatorRewards)
    try {
      gas = gas || await props.stargateClient.simulate(props.address, messages)
    } catch (error) {
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
      return
    }
    console.log(messages, gas)

    signAndBroadcast(props.address, messages, gas).then((result) => {
      console.log("Successfully broadcasted:", result);
      props.setLoading(false)
      props.onClaimRewards(result)
    }, (error) => {
      console.log('Failed to broadcast:', error)
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
    })
  }

  // Expects a map of string -> string (validator -> reward)
  function buildMessages(validatorRewards){
    return validatorRewards.map(validatorReward => {
      let valMessages = []

      if(props.restake){
        valMessages.push({
          typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
          value: MsgDelegate.fromPartial({
            delegatorAddress: props.address,
            validatorAddress: validatorReward.validatorAddress,
            amount: coin(validatorReward.reward, props.network.denom)
          })
        })
      }else{
        valMessages.push({
          typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
          value: MsgWithdrawDelegatorReward.fromPartial({
            delegatorAddress: props.address,
            validatorAddress: validatorReward.validatorAddress
          })
        })
      }
      
      if (props.commission) {
        valMessages.push({
          typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission",
          value: MsgWithdrawValidatorCommission.fromPartial({
            validatorAddress: validatorReward.validatorAddress
          })
        })
      }

      return valMessages
    }).flat()
  }

  function buttonText() {
    if(props.restake){
      return 'Manual Compound'
    }else if(props.commission){
      return 'Claim Commission'
    }else{
      return 'Claim Rewards'
    }
  }

  return (
    <>
      <Dropdown.Item onClick={() => claim()}>
        {buttonText()}
      </Dropdown.Item>
    </>
  )
}

export default ClaimRewards;
