import _ from 'lodash'
import {
  Dropdown,
  Button
} from 'react-bootstrap'

function RevokeGrant(props) {
  const { address, grantAddress, grants, stargateClient } = props

  const buttonText = props.buttonText || 'Revoke'

  async function revoke(){
    if(props.setLoading) props.setLoading(true)

    const messages = _.compact(grants).map(grant => {
      switch (grant.authorization['@type']) {
        case "/cosmos.staking.v1beta1.StakeAuthorization":
          return buildRevokeMsg("/cosmos.staking.v1beta1.MsgDelegate")
        case "/cosmos.authz.v1beta1.GenericAuthorization":
          return buildRevokeMsg(grant.authorization.msg)
      }
    })
      
    console.log(messages)

    try {
      const gas = await stargateClient.simulate(address, messages)
      const result = await stargateClient.signAndBroadcast(address, messages, gas)
      console.log("Successfully broadcasted:", result);
      if(props.setLoading) props.setLoading(false)
      props.onRevoke(grantAddress, messages.map(el => el.value.msgTypeUrl))
    } catch (error) {
      console.log('Failed to broadcast:', error)
      if(props.setLoading) props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
    }
  }

  function buildRevokeMsg(type){
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgRevoke",
      value: {
        granter: address,
        grantee: grantAddress,
        msgTypeUrl: type
      },
    }
  }

  if(props.button){
    return (
      <Button variant="danger" size={props.size} onClick={() => revoke()}>
        {buttonText}
      </Button>
    )
  }

  return (
    <Dropdown.Item onClick={() => revoke()} >
      {buttonText}
    </Dropdown.Item>
  )
}

export default RevokeGrant;
