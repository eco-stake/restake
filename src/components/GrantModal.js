import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import moment from 'moment'

import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";

import {
  Modal,
  Button,
  Form,
  Collapse
} from 'react-bootstrap'

import AlertMessage from './AlertMessage';

const messageTypes = [
  // '/cosmos.authz.v1beta1.MsgGrant',
  // '/cosmos.authz.v1beta1.MsgRevoke',
  // '/cosmos.authz.v1beta1.MsgExec',
  '/cosmos.gov.v1beta1.MsgVote',
  '/cosmos.gov.v1beta1.MsgDeposit',
  '/cosmos.gov.v1beta1.MsgSubmitProposal',
  '/cosmos.bank.v1beta1.MsgSend',
  '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorRewards',
  '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
  '/cosmos.staking.v1beta1.MsgDelegate',
  '/cosmos.staking.v1beta1.MsgUndelegate',
  '/cosmos.staking.v1beta1.MsgBeginRedelegate',
  'Custom'
]

function GrantModal(props) {
  const { show, network, address } = props
  const isNanoLedger = props.stargateClient?.getIsNanoLedger()
  const defaultExpiry = moment().add(1, 'year')
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState()
  const [state, setState] = useState({ maxTokensValue: '', expiryDateValue: defaultExpiry.format('YYYY-MM-DD') });
  const [showLedger, setShowLedger] = useState(isNanoLedger)

  const { daemon_name, chain_id } = network.chain.chainData

  useEffect(() => {
    setState({
      ...state,
      granteeValue: '',
      expiryDateValue: defaultExpiry.format('YYYY-MM-DD'),
      grantTypeValue: '/cosmos.authz.v1beta1.GenericAuthorization',
      messageTypeValue: messageTypes[0],
      customMessageTypeValue: '',
    })
    setShowLedger(isNanoLedger)
    setError(null)
  }, [address])

  function handleInputChange(e) {
    setState({ ...state, [e.target.name]: e.target.value });
  }

  function showLoading(isLoading) {
    setLoading(isLoading)
    props.setLoading && props.setLoading(isLoading)
  }

  function messageType(){
    return state.messageTypeValue === 'Custom' ? state.customMessageTypeValue : state.messageTypeValue
  }

  function handleSubmit(event) {
    event.preventDefault()
    if(!address || isNanoLedger || !valid()) return

    showLoading(true)
    const expiry = moment(state.expiryDateValue)

    const messages = [
      buildGrantMsg(state.grantTypeValue,
        GenericAuthorization.encode(GenericAuthorization.fromPartial({
          msg: messageType()
        })).finish(),
        expiry
      )
    ]
    console.log(messages)

    props.stargateClient.signAndBroadcast(address, messages).then((result) => {
      console.log("Successfully broadcasted:", result);
      showLoading(false)
      props.onGrant(state.granteeValue, {
        grantee: state.granteeValue,
        granter: address,
        expiration: expiry,
        authorization: {
          '@type': state.grantTypeValue,
          msg: messageType()
        }
      });
    }, (error) => {
      console.log('Failed to broadcast:', error)
      showLoading(false)
      setError('Failed to broadcast: ' + error.message)
    })
  }

  function handleClose() {
    setError(null)
    props.closeModal();
  }

  function buildGrantMsg(type, value, expiryDate) {
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
      value: {
        granter: address,
        grantee: state.granteeValue,
        grant: {
          authorization: {
            typeUrl: type,
            value: value
          },
          expiration: Timestamp.fromPartial({
            seconds: expiryDate.unix(),
            nanos: 0
          })
        }
      },
    }
  }

  function valid(){
    return validGrantee()
  }

  function validGrantee(){
    if(!state.granteeValue) return true;

    return !network.prefix || state.granteeValue.startsWith(network.prefix)
  }

  return (
    <>
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title className="text-truncate pe-4">
          {address && !isNanoLedger ? 'New Grant' : 'CLI/Ledger instructions'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error &&
            <AlertMessage variant="danger" className="text-break small">
              {error}
            </AlertMessage>
          }
          {!address || isNanoLedger && (
            <>
              <p>Enter your grant details to generate the relevant CLI command.</p>
            </>
          )}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Grantee</Form.Label>
              <Form.Control type="text" name='granteeValue' required={true} value={state.granteeValue} isInvalid={!validGrantee()} onChange={handleInputChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Expiry date</Form.Label>
              <Form.Control type="date" name='expiryDateValue' min={moment().format('YYYY-MM-DD')} required={true} value={state.expiryDateValue} onChange={handleInputChange} />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Grant type</Form.Label>
              <select className="form-select" name="grantTypeValue" aria-label="Grant type" value={state.grantTypeValue} onChange={handleInputChange}>
                <option value="/cosmos.authz.v1beta1.GenericAuthorization">GenericAuthorization</option>
              </select>
            </Form.Group>
            {state.grantTypeValue === '/cosmos.authz.v1beta1.GenericAuthorization' && (
              <>
              <Form.Group className="mb-3">
                <Form.Label>Message type</Form.Label>
                <select className="form-select" name="messageTypeValue" aria-label="Message type" value={state.messageTypeValue} onChange={handleInputChange}>
                  {messageTypes.map(type => {
                  return (
                    <option key={type} value={type}>{_.startCase(type.split('.').slice(-1)[0].replace('Msg', ''))}</option>
                  )
                  })}
                </select>
              </Form.Group>
              {state.messageTypeValue === 'Custom' && (
                <Form.Group className="mb-3">
                  <Form.Label>Type URL</Form.Label>
                  <Form.Control type="text" name='customMessageTypeValue' required={true} value={state.customMessageTypeValue} onChange={handleInputChange} />
                </Form.Group>
              )}
              </>
            )}
            <p><strong>Incorrect use of Authz grants can be as dangerous as giving away your mnemonic.</strong> Make sure you trust the Grantee address and understand the permissions you are granting.</p>
            {address && !isNanoLedger && (
              <p className="text-end">
                <Button
                  variant="link"
                  onClick={() => setShowLedger(!showLedger)}
                  aria-controls="example-collapse-text"
                  aria-expanded={showLedger}
                >CLI command</Button>
                {!loading
                  ? (
                    <Button type="submit" className="btn btn-primary ms-2">Create grant</Button>
                  )
                  : <Button className="btn btn-primary" type="button" disabled>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                  </Button>
                }
              </p>
            )}
            <Collapse in={showLedger}>
            <pre className="text-wrap"><code>
              <p>{daemon_name ? daemon_name : <kbd>{'<chaind>'}</kbd>} tx authz grant \<br />
                <kbd>{state.granteeValue || '<grantee>'}</kbd> generic \<br />
                --msg-type <kbd>{messageType()}</kbd> \<br />
                --expiration <kbd>{moment(state.expiryDateValue).unix()}</kbd> \<br />
                --from <kbd>my-key</kbd> \<br />
                --chain-id {chain_id} \<br />
                --node https://rpc.cosmos.directory:443/{network.name} \<br />
                --gas auto --gas-prices {network.gasPrice} --gas-adjustment 1.5</p>
            </code></pre>
            </Collapse>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default GrantModal
