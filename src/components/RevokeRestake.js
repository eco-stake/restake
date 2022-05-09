import {
  Dropdown,
  Button
} from 'react-bootstrap'

function RevokeRestake(props) {
  const { address, operator, grants, stargateClient } = props

  async function revoke(){
    props.setLoading(true)

    const messages = []
    if(grants.stakeGrant) messages.push(buildRevokeMsg("/cosmos.staking.v1beta1.MsgDelegate"))
    if(grants.claimGrant) messages.push(buildRevokeMsg("/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward")) // clean-up now unnecessary MsgWithdraw grant
      
    console.log(messages)

    try {
      const gas = await stargateClient.simulate(address, messages, undefined, 1.3)
      const result = await stargateClient.signAndBroadcast(address, messages, gas)
      console.log("Successfully broadcasted:", result);
      props.setLoading(false)
      props.onRevoke(operator)
    } catch (error) {
      console.log('Failed to broadcast:', error)
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
    }
  }

  function buildRevokeMsg(type){
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgRevoke",
      value: {
        granter: address,
        grantee: operator.botAddress,
        msgTypeUrl: type
      },
    }
  }

  if(props.button){
    return (
      <Button variant="danger" onClick={() => revoke()}>
        Disable REStake
      </Button>
    )
  }

  return (
    <Dropdown.Item onClick={() => revoke()} >
      Disable REStake
    </Dropdown.Item>
  )
}

export default RevokeRestake;
