import Coins from './Coins'

import {
  coin
} from '@cosmjs/stargate'
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";

import {
  Dropdown,
  Badge
} from 'react-bootstrap'

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

    const totalReward = props.validatorRewards.reduce((sum, validatorReward) => sum + validatorReward.reward, 0);
    const adjustedValidatorRewards = props.validatorRewards.map(validatorReward => {
      const shareOfFee = (validatorReward.reward / totalReward) * feeAmount; // To take a proportional amount from each validator relative to total reward
      return {
        validatorAddress: validatorReward.validatorAddress,
        reward: validatorReward.reward - shareOfFee,
      }
    })

      signAndBroadcast = props.stargateClient.signAndBroadcastWithoutBalanceCheck

    if(adjustedValidatorRewards.some(validatorReward => validatorReward.reward <= 0)) {
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

      valMessages.push({
        typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
        value: MsgWithdrawDelegatorReward.fromPartial({
          delegatorAddress: props.address,
          validatorAddress: validatorReward.validatorAddress
        })
      })

      if(props.restake){
        valMessages.push({
          typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
          value: MsgDelegate.fromPartial({
            delegatorAddress: props.address,
            validatorAddress: validatorReward.validatorAddress,
            amount: coin(parseInt(validatorReward.reward), props.network.denom)
          })
        })
      }

      return valMessages
    }).flat()
  }

  return (
    <>
      {props.validatorRewards.length > 0 && (
        <Dropdown.Item onClick={() => claim()}>
          {props.restake ? 'Manual Compound' : 'Claim Rewards'}
        </Dropdown.Item>
      )}
    </>
  )
}

export default ClaimRewards;
