import { MsgWithdrawDelegatorReward, MsgWithdrawValidatorCommission } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { buildExecableMessage, buildExecMessage, coin } from "../utils/Helpers.mjs";

import {
  Dropdown
} from 'react-bootstrap'

import { add, subtract, multiply, divide, bignumber, floor } from 'mathjs'

function ClaimRewards(props) {
  const { address, wallet, stargateClient, validatorRewards } = props

  async function claim(){
    props.setLoading(true)

    const gasSimMessages = buildMessages(validatorRewards)

    let gas
    try {
      gas = await stargateClient.simulate(wallet.address, gasSimMessages)
    } catch (error) {
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
      return
    }

    const fee = stargateClient.getFee(gas)
    const feeAmount = fee.amount[0].amount

    const totalReward = validatorRewards.reduce((sum, validatorReward) => add(sum, bignumber(validatorReward.reward)), 0);
    const adjustedValidatorRewards = validatorRewards.map(validatorReward => {
      const shareOfFee = multiply(divide(validatorReward.reward, totalReward), feeAmount); // To take a proportional amount from each validator relative to total reward
      return {
        validatorAddress: validatorReward.validatorAddress,
        reward: subtract(validatorReward.reward, shareOfFee),
      }
    })

    if(!props.commission && (adjustedValidatorRewards.length < 1 || adjustedValidatorRewards.some(validatorReward => validatorReward.reward <= 0))) {
      props.setLoading(false)
      props.setError('Reward is too low')
      return
    }

    let messages = buildMessages(adjustedValidatorRewards)
    try {
      gas = gas || await stargateClient.simulate(wallet.address, messages)
    } catch (error) {
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
      return
    }
    console.log(messages, gas)

    const signAndBroadcast = stargateClient.signAndBroadcastWithoutBalanceCheck
    signAndBroadcast(wallet.address, messages, gas).then((result) => {
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
        valMessages.push(buildExecableMessage(MsgDelegate, "/cosmos.staking.v1beta1.MsgDelegate", {
          delegatorAddress: address,
          validatorAddress: validatorReward.validatorAddress,
          amount: coin(validatorReward.reward, props.network.denom)
        }, wallet?.address !== address))
      }else{
        valMessages.push(buildExecableMessage(MsgWithdrawDelegatorReward, "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward", {
          delegatorAddress: address,
          validatorAddress: validatorReward.validatorAddress
        }, wallet?.address !== address))
      }
      
      if (props.commission) {
        valMessages.push(buildExecableMessage(MsgWithdrawValidatorCommission, "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission", {
          validatorAddress: validatorReward.validatorAddress
        }, wallet?.address !== address))
      }

      if (wallet?.address !== address) {
        return [buildExecMessage(wallet.address, valMessages)]
      }else{
        return valMessages
      }
    }).flat()
  }

  function hasPermission(){
    const permissions = []
    if(props.restake) permissions.push('Delegate')
    if(!props.restake) permissions.push('WithdrawDelegatorReward')
    if(props.commission) permissions.push('WithdrawValidatorCommission')
    return permissions.every(type => wallet?.hasPermission(address, type))
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
      <Dropdown.Item as="button" disabled={props.disabled || !hasPermission()} onClick={() => claim()}>
        {buttonText()}
      </Dropdown.Item>
    </>
  )
}

export default ClaimRewards;
