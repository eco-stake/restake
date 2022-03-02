import React, { useState } from 'react';

import {
  Button
} from 'react-bootstrap'

function RevokeRestake(props) {
  const [loading, setLoading] = useState(false);

  function revoke(){
    setLoading(true)

    const messages = [
      buildRevokeMsg("/cosmos.staking.v1beta1.MsgDelegate"),
      buildRevokeMsg("/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward")
    ]
    console.log(messages)

    props.stargateClient.signAndBroadcast(props.address, messages).then((result) => {
      console.log("Successfully broadcasted:", result);
      setLoading(false)
      props.onRevoke(props.operator)
    }, (error) => {
      console.log('Failed to broadcast:', error)
      setLoading(false)
      props.setError('Failed to broadcast TX')
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

  return (
    <>
      {!loading
        ? (
          <Button className="mr-5" onClick={() => revoke()} size={props.size} disabled={props.disabled} variant={props.variant}>
            Revoke
          </Button>
        ) : (
          <Button className="mr-5" disabled size={props.size} variant={props.variant}>
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
          </Button>
        )
      }
    </>
  )
}

export default RevokeRestake;
