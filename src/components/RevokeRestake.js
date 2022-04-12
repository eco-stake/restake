import {
  Dropdown,
  Button
} from 'react-bootstrap'

function RevokeRestake(props) {
  function revoke(){
    props.setLoading(true)

    const messages = [
      buildRevokeMsg("/cosmos.staking.v1beta1.MsgDelegate"),
      buildRevokeMsg("/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward")
    ]
    console.log(messages)

    props.stargateClient.signAndBroadcast(props.address, messages).then((result) => {
      console.log("Successfully broadcasted:", result);
      props.setLoading(false)
      props.onRevoke(props.operator)
    }, (error) => {
      console.log('Failed to broadcast:', error)
      props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
    })
  }

  function buildRevokeMsg(type){
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgRevoke",
      value: {
        granter: props.address,
        grantee: props.operator.botAddress,
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
