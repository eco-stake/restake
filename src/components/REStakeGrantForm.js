import React, { useState, useEffect, useReducer } from 'react';
import moment from 'moment'
import { pow, multiply, divide, larger, bignumber } from 'mathjs'

import { MsgGrant } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { StakeAuthorization } from "cosmjs-types/cosmos/staking/v1beta1/authz";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";

import {
  Button,
  Form,
} from 'react-bootstrap'

import Coins from './Coins';
import { buildExecMessage, coin, rewardAmount } from '../utils/Helpers.mjs';
import RevokeGrant from './RevokeGrant';
import AlertMessage from './AlertMessage';
import OperatorLastRestakeAlert from './OperatorLastRestakeAlert';

function REStakeGrantForm(props) {
  const { grants, wallet, operator, address, network, lastExec } = props
  const { stakeGrant, maxTokens, validators } = grants || {}
  const defaultExpiry = moment().add(1, 'year')
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState()
  const [state, setState] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    { maxTokensValue: '', expiryDateValue: defaultExpiry.format('YYYY-MM-DD') }
  )

  const reward = rewardAmount(props.rewards, network.denom)

  useEffect(() => {
    setState({
      validators: validators || (!stakeGrant && [operator.address]),
      maxTokens,
      expiryDate: expiryDate(),
    })
  }, [grants, operator])

  useEffect(() => {
    setState({
      expiryDateValue: (expiryDate() || defaultExpiry).format('YYYY-MM-DD'),
      maxTokensValue: maxTokens && state.maxTokensValue === '' ? divide(bignumber(maxTokens), pow(10, network.decimals)) : maxTokens ? state.maxTokensValue : '',
    })
  }, [operator])

  function handleInputChange(e) {
    setState({ [e.target.name]: e.target.value });
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
    return !maxTokensDenom() || larger(maxTokensDenom(), reward)
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

    props.signingClient.signAndBroadcast(wallet.address, messages).then((result) => {
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
    if (wallet?.address !== address) {
      return buildExecMessage(wallet.address, [{
        typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
        value: MsgGrant.encode(MsgGrant.fromPartial(value)).finish()
      }])
    } else {
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
        <p className="small"><strong>Delegate</strong> - allowed to delegate <em>{maxTokensDenom() ? <Coins coins={{ amount: maxTokensDenom(), denom: network.denom }} asset={network.baseAsset} fullPrecision={true} hideValue={true} /> : 'any amount'}</em> to <em>{!state.validators ? 'any validator' : !state.validators.length || (state.validators.length === 1 && state.validators.includes(operator.address)) ? 'only their own validator' : 'validators ' + state.validators.join(', ')}</em>.</p>
        <p className="small">This grant will expire automatically on <em>{state.expiryDateValue}</em>.</p>
        <p className="small">REStake only re-delegates {operator.moniker}'s accrued rewards and tries not to touch your balance.</p>
        <p className="small"><em>REStake previously required a Withdraw grant but this is no longer necessary.</em></p>
      </>
    )
  }

  const step = () => {
    return 1 / pow(10, network.decimals)
  }

  return (
    <>
      <OperatorLastRestakeAlert operator={operator} lastExec={lastExec} />
      {error &&
        <AlertMessage variant="danger" className="text-break small">
          {error}
        </AlertMessage>
      }
      <div className="row">
        <div className="col-12 col-md-6 order-md-1 mb-3">
          <Form onSubmit={handleSubmit}>
            <fieldset disabled={!props.address || !props.wallet}>
              <Form.Group className="mb-3">
                <Form.Label>Max amount</Form.Label>
                <div className="mb-3">
                  <div className="input-group">
                    <Form.Control type="number" name="maxTokensValue" min={divide(1, pow(10, network.decimals))} className={!maxTokensValid() ? 'is-invalid' : 'is-valid'} step={step()} placeholder={maxTokens ? divide(bignumber(maxTokens), pow(10, network.decimals)) : 'Unlimited'} required={false} value={state.maxTokensValue} onChange={handleInputChange} />
                    <span className="input-group-text">{network.symbol}</span>
                  </div>
                  <div className="form-text text-end">
                    Reduces with every delegation made by the validator<br />Leave empty for unlimited
                  </div>
                </div>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Expiry date</Form.Label>
                <Form.Control type="date" className="text-start" name='expiryDateValue' min={moment().format('YYYY-MM-DD')} required={true} value={state.expiryDateValue} onChange={handleInputChange} />
                <div className="form-text text-end">Date the grant will expire. After this date you will need to re-grant</div>
              </Form.Group>
              <div className="text-end">
                {!loading
                  ? (
                    <div className="d-flex justify-content-end gap-2">
                      {props.closeForm && (
                        <Button variant="secondary" onClick={props.closeForm}>Cancel</Button>
                      )}
                      {grants.grantsExist && (
                        <RevokeGrant
                          button={true}
                          address={address}
                          wallet={wallet}
                          operator={operator}
                          grants={[grants.stakeGrant, grants.claimGrant]}
                          grantAddress={operator.botAddress}
                          signingClient={props.signingClient}
                          onRevoke={props.onRevoke}
                          setLoading={(loading) => showLoading(loading)}
                          setError={setError}
                          buttonText="Disable"
                        />
                      )}
                      <Button type="submit" disabled={!wallet?.hasPermission(address, 'Grant')} className="btn btn-primary">{grants.grantsExist ? 'Update' : 'Enable REStake'}</Button>
                    </div>
                  )
                  : <Button className="btn btn-primary" type="button" disabled>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                  </Button>
                }
              </div>
            </fieldset>
          </Form>
        </div>
        <div className="col-12 col-md-6 mb-3">
          {grantInformation()}
        </div>
      </div>
    </>
  )
}

export default REStakeGrantForm;
