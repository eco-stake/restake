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

    const perValidatorReward = parseInt(props.rewards.amount / props.validators.length)
    let messages = props.validators.map(el => {
      let valMessages = [{
        typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
        value: MsgWithdrawDelegatorReward.fromPartial({
          delegatorAddress: props.address,
          validatorAddress: el
        })
      }]

      if(props.restake){
        valMessages.push({
          typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
          value: MsgDelegate.fromPartial({
            delegatorAddress: props.address,
            validatorAddress: el,
            amount: coin(perValidatorReward, 'uosmo')
          })
        })
      }

      return valMessages
    }).flat()
    console.log(messages)

    props.stargateClient.signAndBroadcast(props.address, messages, 600_000).then((result) => {
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
