import React, { useState, useReducer } from 'react';
import { MsgDelegate, MsgUndelegate, MsgBeginRedelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";

import {
  Button,
  Form,
  Alert
} from 'react-bootstrap'

import { pow, multiply, divide, subtract, bignumber } from 'mathjs'

import Coins from './Coins'
import { buildExecMessage, coin } from '../utils/Helpers.mjs'

function DelegateForm(props) {
  const { network, wallet, address, validator, selectedValidator, action } = props
  const [state, setState] = useReducer(
    (state, newState) => ({ ...state, ...newState }),
    { amount: '', memo: '' }
  )

  function handleInputChange(event) {
    const target = event.target;
    const value = target.value;
    const name = target.name;

    setState({
      [name]: value
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setState({ loading: true, error: null })

    const amount = state.amount
    const memo = state.memo
    const client = props.signingClient

    const decimals = pow(10, network.decimals)
    const denomAmount = bignumber(multiply(amount, decimals))

    let messages = buildMessages(denomAmount)
    let gas
    try {
      gas = await client.simulate(wallet.address, messages)
    } catch (error) {
      setState({ loading: false, error: error.message })
      return
    }

    client.signAndBroadcast(wallet.address, messages, gas, memo).then((result) => {
      console.log("Successfully broadcasted:", result);
      setState({ loading: false, error: null })
      props.onDelegate()
    }, (error) => {
      console.log('Failed to broadcast:', error)
      setState({ loading: false, error: `Failed to broadcast: ${error.message}` })
    })
  }

  function buildMessages(amount) {
    let message, type, typeUrl, value
    if (action === 'redelegate') {
      type = MsgBeginRedelegate
      typeUrl = "/cosmos.staking.v1beta1.MsgBeginRedelegate"
      value = {
        delegatorAddress: address,
        validatorSrcAddress: validator.operator_address,
        validatorDstAddress: selectedValidator.operator_address,
        amount: coin(amount, network.denom)
      }
    } else {
      type = action === 'undelegate' ? MsgUndelegate : MsgDelegate
      typeUrl = "/cosmos.staking.v1beta1.Msg" + (action === 'undelegate' ? 'Undelegate' : 'Delegate')
      value = {
        delegatorAddress: address,
        validatorAddress: validator.operator_address,
        amount: coin(amount, network.denom)
      }
    }
    if (wallet?.address !== address) {
      message = buildExecMessage(wallet.address, [{
        typeUrl: typeUrl,
        value: type.encode(type.fromPartial(value)).finish()
      }])
    } else {
      message = {
        typeUrl: typeUrl,
        value: value
      }
    }
    return [message]
  }

  function hasPermission() {
    const permission = action === 'redelegate' ? 'BeginRedelegate' : action === 'undelegate' ? 'Undelegate' : 'Delegate'
    return wallet?.hasPermission(address, permission)
  }

  async function setAvailableAmount() {
    if (!wallet) return

    setState({ error: undefined })
    const messages = buildMessages(multiply(availableBalance().amount, 0.95))
    const decimals = pow(10, network.decimals)
    const balance = bignumber(availableBalance().amount)
    if (['redelegate', 'undelegate'].includes(action)) {
      return setState({ amount: divide(balance, decimals) })
    }
    props.signingClient.simulate(wallet.address, messages).then(gas => {
      const gasPrice = props.signingClient.getFee(gas).amount[0].amount
      const saveTxFeeNum = 10
      const amount = divide(subtract(balance, multiply(gasPrice, saveTxFeeNum)), decimals)

      setState({ amount: amount > 0 ? amount : 0 })
    }, error => {
      setState({ error: error.message })
    })
  }

  function availableBalance() {
    if (['redelegate', 'undelegate'].includes(action)) {
      return (props.delegation || {}).balance;
    } else {
      return props.balance;
    }
  }

  function actionText() {
    if (action === 'redelegate') return 'Redelegate'
    if (action === 'undelegate') return 'Undelegate'
    return 'Delegate'
  }

  function denom() {
    return network.symbol
  }

  function step() {
    return 1 / pow(10, network.decimals)
  }

  return (
    <>
      {state.error &&
        <Alert variant="danger">
          {state.error}
        </Alert>
      }
        <Form onSubmit={handleSubmit}>
          <fieldset disabled={!address || !wallet}>
            <Form.Group className="mb-3">
              <Form.Label>Amount</Form.Label>
              <div className="mb-3">
                <div className="input-group">
                  <Form.Control name="amount" type="number" min={0} step={step()} placeholder="10" required={true} value={state.amount} onChange={handleInputChange} />
                  <span className="input-group-text">{denom()}</span>
                </div>
                {availableBalance() &&
                  <div className="form-text text-end"><span role="button" onClick={() => setAvailableAmount()}>
                    Available: <Coins coins={availableBalance()} asset={network.baseAsset} fullPrecision={true} hideValue={true} />
                  </span></div>
                }
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Memo</Form.Label>
              <Form.Control name="memo" as="textarea" rows={3} value={state.memo} onChange={handleInputChange} />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              {!state.loading
                ? (
                <>
                  {props.closeForm && (
                    <Button variant="secondary" onClick={props.closeForm}>Cancel</Button>
                  )}
                  <Button type="submit" disabled={!hasPermission()} className="btn btn-primary">{actionText()}</Button>
                </>
                ) : <Button className="btn btn-primary" type="button" disabled>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                </Button>
              }
            </div>
          </fieldset>
        </Form>
    </>
  )
}

export default DelegateForm
