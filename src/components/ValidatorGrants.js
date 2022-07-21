import React, { useState, useEffect } from 'react';
import moment from 'moment'
import { pow, multiply, divide, larger, smaller, bignumber } from 'mathjs'

import { MsgGrant } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { StakeAuthorization } from "cosmjs-types/cosmos/staking/v1beta1/authz";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";

import {
  Button,
  Form,
  Table
} from 'react-bootstrap'

import Coins from './Coins';
import { buildExecMessage, coin } from '../utils/Helpers.mjs';
import RevokeGrant from './RevokeGrant';
import AlertMessage from './AlertMessage';

function ValidatorGrants(props) {
  const { grants, wallet, operator, address, network } = props
  const { stakeGrant, maxTokens, validators, grantsValid, grantsExist } = grants || {}
  const defaultExpiry = moment().add(1, 'year')
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState()
  const [state, setState] = useState({ maxTokensValue: '', expiryDateValue: defaultExpiry.format('YYYY-MM-DD') });

  useEffect(() => {
    setState({
      ...state,
      validators: validators || (!stakeGrant && [operator.address]),
      maxTokens,
      expiryDate: expiryDate(),
    })
  }, [grants, operator])

  useEffect(() => {
    setState({
      ...state,
      expiryDateValue: (expiryDate() || defaultExpiry).format('YYYY-MM-DD'),
      maxTokensValue: maxTokens && state.maxTokensValue === '' ? divide(maxTokens, pow(10, network.decimals)) : maxTokens ? state.maxTokensValue : '',
    })
  }, [operator])

  function handleInputChange(e) {
    setState({ ...state, [e.target.name]: e.target.value });
  }

  function expiryDate() {
    const stakeExpiry = stakeGrant && stakeGrant.expiration && moment(stakeGrant.expiration)
    return stakeExpiry
  }

  function maxTokensDenom() {
    if (state.maxTokensValue === '') return

    const decimals = pow(10, network.decimals)
    return bignumber(multiply(state.maxTokensValue, decimals))
  }

  function maxTokensValid() {
    return !maxTokensDenom() || larger(maxTokensDenom(), props.rewards)
  }

  function showLoading(isLoading) {
    setLoading(isLoading)
    props.setLoading && props.setLoading(isLoading)
  }

  function handleSubmit(event) {
    event.preventDefault()
    showLoading(true)
    const expiry = moment(state.expiryDateValue)
    let maxTokens
    if (state.maxTokensValue !== '') {
      maxTokens = coin(maxTokensDenom(), network.denom)
    }

    const messages = [
      buildGrantMsg("/cosmos.staking.v1beta1.StakeAuthorization",
        StakeAuthorization.encode(StakeAuthorization.fromPartial({
          allowList: { address: [operator.address] },
          maxTokens: maxTokens,
          authorizationType: 1
        })).finish(),
        expiry
      )
    ]
    console.log(messages)

    props.stargateClient.signAndBroadcast(wallet.address, messages).then((result) => {
      console.log("Successfully broadcasted:", result);
      showLoading(false)
      props.onGrant(operator.botAddress, {
        grantee: operator.botAddress,
        granter: address,
        expiration: expiry,
        authorization: {
          '@type': "/cosmos.staking.v1beta1.StakeAuthorization",
          max_tokens: maxTokens,
          allow_list: { address: [operator.address] }
        }
      });
    }, (error) => {
      console.log('Failed to broadcast:', error)
      showLoading(false)
      setError('Failed to broadcast: ' + error.message)
    })
  }

  function buildGrantMsg(type, authValue, expiryDate) {
    const value = {
      granter: address,
      grantee: operator.botAddress,
      grant: {
        authorization: {
          typeUrl: type,
          value: authValue
        },
        expiration: Timestamp.fromPartial({
          seconds: expiryDate.unix(),
          nanos: 0
        })
      }
    }
    if(wallet?.address !== address){
      return buildExecMessage(wallet.address, [{
        typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
        value: MsgGrant.encode(MsgGrant.fromPartial(value)).finish()
      }])
    }else{
      return {
        typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
        value: value
      }
    }
  }

  function grantInformation() {
    return (
      <>
        <p className="small">{operator.moniker} will be able to carry out the following transactions on your behalf.</p>
        <p className="small"><strong>Delegate</strong> - allowed to delegate <em>{maxTokensDenom() ? <Coins coins={{ amount: maxTokensDenom(), denom: network.denom }} decimals={network.decimals} /> : 'any amount'}</em> to <em>{!state.validators ? 'any validator' : !state.validators.length || (state.validators.length === 1 && state.validators.includes(operator.address)) ? 'only their own validator' : 'validators ' + state.validators.join(', ')}</em>.</p>
        <p className="small">This grant will expire automatically on <em>{state.expiryDateValue}</em>.</p>
        <p className="small">REStake only re-delegates {operator.moniker}'s accrued rewards and tries not to touch your balance.</p>
        <p className="small"><em>REStake previously required a Withdraw grant but this is no longer necessary.</em></p>
      </>
    )
  }

  const minimumReward = () => {
    return {
      amount: operator.minimumReward,
      denom: network.denom
    }
  }

  const step = () => {
    return 1 / pow(10, network.decimals)
  }

  return (
    <>
      {!props.authzSupport && (
        <AlertMessage variant="warning" dismissible={false}>
          {props.network.prettyName} doesn't support Authz just yet.
        </AlertMessage>
      )}
      {props.restakePossible && !props.delegation && (
        <AlertMessage variant="warning" dismissible={false}>
          You must delegate to {operator.moniker} before they can REStake for you.
        </AlertMessage>
      )}
      {error &&
        <AlertMessage variant="danger" className="text-break small">
          {error}
        </AlertMessage>
      }
      <Table>
        <tbody className="table-sm small">
          <tr>
            <td scope="row">REStake Address</td>
            <td className="text-break"><span>{operator.botAddress}</span></td>
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
              <Coins coins={{ amount: props.rewards, denom: network.denom }} decimals={network.decimals} />
            </td>
          </tr>
          {state.maxTokens && (
            <tr>
              <td scope="row">Grant Remaining</td>
              <td className={!props.rewards || larger(state.maxTokens, props.rewards) ? 'text-success' : 'text-danger'}>
                <Coins coins={{ amount: state.maxTokens, denom: network.denom }} decimals={network.decimals} />
              </td>
            </tr>
          )}
          <tr>
            <td scope="row">Grant status</td>
            <td>
              {grantsValid
                ? <span className="text-success">Active</span>
                : grantsExist
                  ? state.maxTokens && smaller(state.maxTokens, props.rewards)
                    ? <span className="text-danger">Not enough grant remaining</span>
                    : <span className="text-danger">Invalid / total delegation reached</span>
                  : <em>Inactive</em>}
            </td>
          </tr>
        </tbody>
      </Table>
      {grantsExist && !props.restakePossible && (
        <>{grantInformation()}</>
      )}
      {props.restakePossible && (
        <div className="row">
          <div className="col">
            <p><strong>Grant details</strong></p>
            {grantInformation()}
          </div>
          <div className="col">
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Max amount</Form.Label>
                <div className="mb-3">
                  <div className="input-group">
                    <Form.Control type="number" name="maxTokensValue" min={divide(1, pow(10, network.decimals))} className={!maxTokensValid() ? 'is-invalid' : 'is-valid'} step={step()} placeholder={maxTokens ? divide(maxTokens, pow(10, network.decimals)) : 'Unlimited'} required={false} value={state.maxTokensValue} onChange={handleInputChange} />
                    <span className="input-group-text">{network.symbol.toUpperCase()}</span>
                  </div>
                  <div className="form-text text-end">
                    Reduces with every delegation made by the validator<br />Leave empty for unlimited
                  </div>
                </div>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Expiry date</Form.Label>
                <Form.Control type="date" name='expiryDateValue' min={moment().format('YYYY-MM-DD')} required={true} value={state.expiryDateValue} onChange={handleInputChange} />
                <div className="form-text text-end">Date the grant will expire. After this date you will need to re-grant</div>
              </Form.Group>
              <p className="text-end">
                {!loading
                  ? (
                    <>
                      {grants.grantsExist && (
                        <RevokeGrant
                          button={true}
                          address={address}
                          wallet={wallet}
                          operator={operator}
                          grants={[grants.stakeGrant, grants.claimGrant]}
                          grantAddress={operator.botAddress}
                          stargateClient={props.stargateClient}
                          onRevoke={props.onRevoke}
                          setLoading={(loading) => showLoading(loading)}
                          setError={setError}
                        />
                      )}
                      <Button type="submit" disabled={!wallet?.hasPermission(address, 'Grant')} className="btn btn-primary ms-2">{grants.grantsExist ? 'Update REStake' : 'Enable REStake'}</Button>
                    </>
                  )
                  : <Button className="btn btn-primary" type="button" disabled>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                  </Button>
                }
              </p>
            </Form>
          </div>
        </div>
      )}
    </>
  )
}

export default ValidatorGrants;
