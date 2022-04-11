import React, { useState, useEffect } from 'react';
import moment from 'moment'
import {pow, multiply, divide, larger, smaller} from 'mathjs'

import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { StakeAuthorization } from "cosmjs-types/cosmos/staking/v1beta1/authz";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";

import {
  Button,
  OverlayTrigger,
  Tooltip,
  Modal,
  Dropdown,
  Form,
  Table
} from 'react-bootstrap'

import Coins from './Coins';
import { coin } from '../utils/Helpers.mjs';

function ManageGrant(props) {
  const { grants, operator, address, network } = props
  const { claimGrant, stakeGrant, grantsValid, grantsExist } = grants
  const defaultExpiry = moment().add(1, 'year')
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [state, setState] = useState({ maxTokensValue: '', expiryDateValue: defaultExpiry});

  useEffect(() => {
    const maxTokens = stakeGrant?.authorization?.max_tokens
    const claimExpiry = claimGrant && claimGrant.expiration && moment(claimGrant.expiration)
    const stakeExpiry = stakeGrant && stakeGrant.expiration && moment(stakeGrant.expiration)
    const expiryDate = claimExpiry && stakeExpiry && claimExpiry > stakeExpiry ? stakeExpiry : claimExpiry || stakeExpiry
    setState({
      ...state, 
      maxTokens,
      expiryDate,
      maxTokensValue: maxTokens && state.maxTokensValue === '' ? divide(maxTokens.amount, pow(10, network.decimals)) : state.maxTokensValue,
      expiryDateValue: (expiryDate || defaultExpiry).format('YYYY-MM-DD')
    })
  }, [grants])

  function handleOpen() {
    setShow(true);
  }

  function handleClose() {
    setShow(false);
  }

  function handleInputChange(e) {
    setState({...state, [e.target.name]: e.target.value });
  }

  function maxTokensDenom() {
    if(state.maxTokensValue === '') return

    const decimals = pow(10, network.decimals)
    return multiply(state.maxTokensValue, decimals)
  }

  function maxTokensValid() {
    return !maxTokensDenom() || larger(maxTokensDenom(), props.rewards)
  }

  function showLoading(isLoading){
    setLoading(isLoading)
    props.setLoading && props.setLoading(isLoading)
  }

  function handleSubmit(event){
    event.preventDefault()
    showLoading(true)
    const expiry = moment(state.expiryDateValue)
    let maxTokens
    if(state.maxTokensValue !== ''){
      maxTokens = coin(maxTokensDenom(), network.denom)
    }

    const messages = [
      buildGrantMsg("/cosmos.staking.v1beta1.StakeAuthorization",
        StakeAuthorization.encode(StakeAuthorization.fromPartial({
          allowList: {address: [operator.address]},
          maxTokens: maxTokens,
          authorizationType: 1
        })).finish(),
        expiry
      ),
      buildGrantMsg("/cosmos.authz.v1beta1.GenericAuthorization",
        GenericAuthorization.encode(GenericAuthorization.fromPartial({
          msg: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward'
        })).finish(),
        expiry
      )
    ]
    console.log(messages)

    props.stargateClient.signAndBroadcast(address, messages).then((result) => {
      console.log("Successfully broadcasted:", result);
      showLoading(false)
      props.onGrant(operator, moment().diff(expiry, "seconds") <= 0, maxTokens);
      setShow(false);
    }, (error) => {
      console.log('Failed to broadcast:', error)
      showLoading(false)
      props.setError('Failed to broadcast: ' + error.message)
    })
  }

  function buildGrantMsg(type, value, expiryDate){
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
      value: {
        granter: address,
        grantee: operator.botAddress,
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

  function button(){
    if(props.dropdownItem){
      return (
        <Dropdown.Item onClick={() => handleOpen()} >
          {grants.grantsValid ? 'Manage REStake' : 'Enable REStake'}
        </Dropdown.Item>
      )
    }
    return (
      <Button className="mr-5" onClick={() => handleOpen()} size={props.size} disabled={props.disabled} variant={props.variant}>
        {grants.grantsValid ? 'Manage' : 'Enable'}
      </Button>
    )
  }

  function loadingButton(){
    return (
      <Button className="mr-5" disabled size={props.size} variant={props.variant}>
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
      </Button>
    )
  }

  const minimumReward = () => {
    return {
      amount: operator.minimumReward,
      denom: network.denom
    }
  }

  return (
    <>
      {!loading || props.dropdownItem
        ? (
          <>
            {props.tooltip ? (
              <OverlayTrigger
                key={operator.address}
                placement="top"
                overlay={
                  <Tooltip id={`tooltip-${operator.address}`}>
                    {props.tooltip}
                  </Tooltip>
                }
              >{button()}</OverlayTrigger>
            ) : button()}
          </>
        ) : (
          loadingButton()
        )
      }
      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>
            Manage REStake
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Table>
              <tbody className="table-sm small">
                <tr>
                  <td scope="row">Validator</td>
                  <td className="text-break">{operator.moniker}</td>
                </tr>
                <tr>
                  <td scope="row">REStake Address</td>
                  <td className="text-break">{operator.botAddress}</td>
                </tr>
                <tr>
                  <td scope="row">Frequency</td>
                  <td>
                    <span>{operator.runTimesString()}</span>
                  </td>
                </tr>
                <tr>
                  <td scope="row">Minimum Reward</td>
                  <td>
                    <Coins coins={minimumReward()} decimals={network.decimals} />
                  </td>
                </tr>
                <tr>
                  <td scope="row">Current Rewards</td>
                  <td>
                    <Coins coins={{amount: props.rewards, denom: network.denom}} decimals={network.decimals} />
                  </td>
                </tr>
                {state.maxTokens && (
                <tr>
                  <td scope="row">Grant Remaining</td>
                  <td className={!props.rewards || larger(state.maxTokens.amount, props.rewards) ? 'text-success' : 'text-danger'}>
                    <Coins coins={state.maxTokens} decimals={network.decimals} />
                  </td>
                </tr>
                )}
                <tr>
                  <td scope="row">Grant status</td>
                  <td>
                    {grantsValid 
                      ? <span className="text-success">Valid</span> 
                      : grantsExist 
                      ? state.maxTokens && smaller(state.maxTokens.amount, props.rewards) 
                      ? <span className="text-danger">Not enough grant remaining</span>
                      : <span className="text-danger">Invalid</span> : <em>Missing</em>}
                  </td>
                </tr>
              </tbody>
            </Table>
            <Form.Group className="mb-3">
              <Form.Label>Maximum delegation</Form.Label>
              <div className="mb-3">
                <div className="input-group">
                  <Form.Control name="maxTokensValue" className={!maxTokensValid() ? 'is-invalid' : 'is-valid'} type="number" step={0.000001} placeholder="10" required={false} value={state.maxTokensValue} onChange={handleInputChange} />
                  <span className="input-group-text">{network.symbol.toUpperCase()}</span>
                </div>
                <div className="form-text text-end">
                  Remaining amount this validator can delegate<br />Leave empty for unlimited
                </div>
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Expiry date</Form.Label>
              <Form.Control type="date" name='expiryDateValue' required={true} value={state.expiryDateValue} onChange={handleInputChange} />
              <div className="form-text text-end">Date the grant will expire. After this date you will need to re-grant</div>
            </Form.Group>
            <p className="text-end">
              {!loading
                ? <Button type="submit" className="btn btn-primary">{grants.grantsExist ? 'Update grants' : 'Enable REStake'}</Button>
                : <Button className="btn btn-primary" type="button" disabled>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                </Button>
              }
            </p>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  )
}

export default ManageGrant;
