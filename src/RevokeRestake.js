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
      props.onRevoke()
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
        grantee: props.botAddress,
        msgTypeUrl: type
      },
    }
  }

  return (
    <>
      {!loading
        ? (
          <Button className="btn-danger mr-5" onClick={() => revoke()}>Revoke REStake</Button>
        ) : (
          <Button className="btn-danger mr-5" disabled>
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
            Submitting TX...
          </Button>
        )
      }
    </>
  )
}

export default RevokeRestake;
