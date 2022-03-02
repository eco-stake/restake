import React, { useState } from 'react';

import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { StakeAuthorization } from "cosmjs-types/cosmos/staking/v1beta1/authz";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";

import {
  Button
} from 'react-bootstrap'

function GrantRestake(props) {
  const [loading, setLoading] = useState(false);

  function update(){
    setLoading(true)

    const messages = [
      buildGrantMsg("/cosmos.staking.v1beta1.StakeAuthorization",
        StakeAuthorization.encode(StakeAuthorization.fromPartial({
          allowList: {address: [props.operator.address]},
          authorizationType: 1
        })).finish(),
      ),
      buildGrantMsg("/cosmos.authz.v1beta1.GenericAuthorization",
        GenericAuthorization.encode(GenericAuthorization.fromPartial({
          msg: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward'
        })).finish(),
      )
    ]
    console.log(messages)

    props.stargateClient.signAndBroadcast(props.address, messages).then((result) => {
      console.log("Successfully broadcasted:", result);
      setLoading(false)
      props.onGrant(props.operator)
    }, (error) => {
      console.log('Failed to broadcast:', error)
      setLoading(false)
      props.setError('Failed to broadcast TX')
    })
  }

  function buildGrantMsg(type, value){
    const dateNow = new Date();
    const expiration = new Date(
      dateNow.getFullYear() + 1,
      dateNow.getMonth(),
      dateNow.getDate()
    )
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
      value: {
        granter: props.address,
        grantee: props.operator.botAddress,
        grant: {
          authorization: {
            typeUrl: type,
            value: value
          },
          expiration: Timestamp.fromPartial({
            seconds: expiration.getTime() / 1000,
            nanos: 0
          })
        }
      },
    }
  }

  return (
    <>
      {!loading
        ? (
          <Button className="mr-5" onClick={() => update()} size={props.size} disabled={props.disabled} variant={props.variant}>
            Enable
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

export default GrantRestake;
