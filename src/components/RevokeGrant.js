import _ from 'lodash'
import {
  Dropdown,
  Button
} from 'react-bootstrap'
import { MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { buildExecableMessage, buildExecMessage } from '../utils/Helpers.mjs'

function RevokeGrant(props) {
  const { address, wallet, grantAddress, grants, signingClient } = props

  const buttonText = props.buttonText || 'Revoke'

  async function revoke(){
    if(props.setLoading) props.setLoading(true)

    let msgTypes = _.compact(grants).map(grant => {
      switch (grant.authorization['@type']) {
        case "/cosmos.staking.v1beta1.StakeAuthorization":
          return "/cosmos.staking.v1beta1.MsgDelegate"
        case "/cosmos.authz.v1beta1.GenericAuthorization":
          return grant.authorization.msg
      }
    })
    let messages = msgTypes.map(type => buildRevokeMsg(type))
    if(wallet?.address !== address){
      messages = [buildExecMessage(wallet.address, messages)]
    }
      
    console.log(messages)

    try {
      const gas = await signingClient.simulate(wallet.address, messages)
      const result = await signingClient.signAndBroadcast(wallet.address, messages, gas)
      console.log("Successfully broadcasted:", result);
      if(props.setLoading) props.setLoading(false)
      props.onRevoke(grantAddress, msgTypes)
    } catch (error) {
      console.log('Failed to broadcast:', error)
      if(props.setLoading) props.setLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
    }
  }

  function buildRevokeMsg(type){
    return buildExecableMessage(MsgRevoke, "/cosmos.authz.v1beta1.MsgRevoke", {
      granter: address,
      grantee: grantAddress,
      msgTypeUrl: type
    }, wallet?.address !== address)
  }

  function disabled(){
    return props.disabled || !wallet?.hasPermission(address, 'Revoke') || !wallet?.authzSupport()
  }

  if(props.button){
    return (
      <Button variant="danger" size={props.size} disabled={disabled()} onClick={() => revoke()}>
        {buttonText}
      </Button>
    )
  }

  return (
    <Dropdown.Item as="button" disabled={disabled()} onClick={() => revoke()} >
      {buttonText}
    </Dropdown.Item>
  )
}

export default RevokeGrant;
