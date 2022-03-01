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
  function claim(){
    props.setLoading(true)

    const gas = props.validators.reduce((sum, el) => {
      return sum + (props.restake ? 300_000 : 100_000)
    }, 0)
    const fee = props.stargateClient.getFee(gas)

    let totalReward, perValidatorReward

    let signAndBroadcast = props.stargateClient.signAndBroadcast

    if(props.restake){
      signAndBroadcast = props.stargateClient.signAndBroadcastWithoutBalanceCheck
      totalReward = (props.rewards.amount - fee.amount[0].amount)
      perValidatorReward = parseInt(totalReward / props.validators.length)
      console.log(gas, fee, totalReward, perValidatorReward, perValidatorReward * props.validators.length)
      if(perValidatorReward <= 0){
        props.setLoading(false)
        props.setError('Reward is too low')
        return
      }
    }
    let messages = props.validators.map(el => {
      let valMessages = []

      valMessages.push({
        typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
        value: MsgWithdrawDelegatorReward.fromPartial({
          delegatorAddress: props.address,
          validatorAddress: el
        })
      })

      if(props.restake){
        valMessages.push({
          typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
          value: MsgDelegate.fromPartial({
            delegatorAddress: props.address,
            validatorAddress: el,
            amount: coin(perValidatorReward, props.network.denom)
          })
        })
      }

      return valMessages
    }).flat()
    console.log(messages)

    signAndBroadcast(props.address, messages, gas).then((result) => {
      console.log("Successfully broadcasted:", result);
      props.setLoading(false)
      props.onClaimRewards(result)
    }, (error) => {
      console.log('Failed to broadcast:', error)
      props.setLoading(false)
      props.setError('Failed to broadcast TX')
    })
  }

  return (
    <>
      {props.validators.length > 0 && (
        <Dropdown.Item onClick={() => claim()}>
          {props.restake ? 'REStake' : 'Claim'} <Badge bg="secondary"><Coins coins={props.rewards} /></Badge>
        </Dropdown.Item>
      )}
    </>
  )
}

export default ClaimRewards;
