import React from 'react'
import Coins from './Coins'
import { buildExecMessage, coin } from '../utils/Helpers.mjs'
import { MsgDelegate, MsgUndelegate, MsgBeginRedelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";

import {
  Button,
  Form,
  Alert
} from 'react-bootstrap'

import { pow, multiply, divide, subtract, bignumber } from 'mathjs'

class DelegateForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {amount: '', memo: ''}

    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleInputChange(event) {
    const target = event.target;
    const value = target.value;
    const name = target.name;

    this.setState({
      [name]: value
    });
  }

  async handleSubmit(event) {
    event.preventDefault();

    this.setState({loading: true, error: null})

    const wallet = this.props.wallet
    const amount = this.state.amount
    const memo = this.state.memo
    const client = this.props.signingClient

    const decimals = pow(10, this.props.network.decimals)
    const denomAmount = bignumber(multiply(amount, decimals))

    let messages = this.buildMessages(denomAmount)
    let gas
    try {
       gas = await client.simulate(wallet.address, messages)
    } catch (error) {
      this.setState({ loading: false, error: error.message })
      return
    }

    client.signAndBroadcast(wallet.address, messages, gas, memo).then((result) => {
      console.log("Successfully broadcasted:", result);
      this.setState({loading: false, error: null})
      this.props.onDelegate()
    }, (error) => {
      console.log('Failed to broadcast:', error)
      this.setState({ loading: false, error: `Failed to broadcast: ${error.message}` })
    })
  }

  buildMessages(amount){
    const { wallet, address } = this.props
    const validatorAddress = this.props.selectedValidator.operator_address
    let message, type, typeUrl, value
    if(this.props.redelegate){
      type = MsgBeginRedelegate
      typeUrl = "/cosmos.staking.v1beta1.MsgBeginRedelegate"
      value = {
        delegatorAddress: address,
        validatorSrcAddress: this.props.validator.operator_address,
        validatorDstAddress: validatorAddress,
        amount: coin(amount, this.props.network.denom)
      }
    }else{
      type = this.props.undelegate ? MsgUndelegate : MsgDelegate
      typeUrl = "/cosmos.staking.v1beta1.Msg" + (this.props.undelegate ? 'Undelegate' : 'Delegate')
      value = {
        delegatorAddress: address,
        validatorAddress: validatorAddress,
        amount: coin(amount, this.props.network.denom)
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

  hasPermission(){
    const permission = this.props.redelegate ? 'BeginRedelegate' : this.props.undelegate ? 'Undelegate' : 'Delegate'
    return this.props.wallet?.hasPermission(this.props.address, permission)
  }

  async setAvailableAmount(){
    if(!this.props.wallet) return

    this.setState({error: undefined})
    const messages = this.buildMessages(multiply(this.props.availableBalance.amount, 0.95))
    const decimals = pow(10, this.props.network.decimals)
    const balance = bignumber(this.props.availableBalance.amount)
    if(this.props.redelegate || this.props.undelegate){
      return this.setState({amount: divide(balance, decimals)})
    }
    this.props.signingClient.simulate(this.props.wallet.address, messages).then(gas => {
      const gasPrice = this.props.signingClient.getFee(gas).amount[0].amount
      const saveTxFeeNum = 10
      const amount = divide(subtract(balance, multiply(gasPrice, saveTxFeeNum)), decimals)

      this.setState({amount: amount > 0 ? amount : 0})
    }, error => {
      this.setState({error: error.message})
    })
  }

  actionText(){
    if(this.props.redelegate) return 'Redelegate'
    if(this.props.undelegate) return 'Undelegate'
    return 'Delegate'
  }

  denom(){
    return this.props.network.symbol
  }

  step(){
    return 1 / pow(10, this.props.network.decimals)
  }

  render() {
    return (
      <>
        {this.state.error &&
        <Alert variant="danger">
          {this.state.error}
        </Alert>
        }
        <Form onSubmit={this.handleSubmit}>
          <fieldset disabled={!this.props.address || !this.props.wallet}>
            <Form.Group className="mb-3">
              <Form.Label>Amount</Form.Label>
              <div className="mb-3">
                <div className="input-group">
                  <Form.Control name="amount" type="number" min={0} step={this.step()} placeholder="10" required={true} value={this.state.amount} onChange={this.handleInputChange} />
                  <span className="input-group-text">{this.denom()}</span>
                </div>
                {this.props.availableBalance &&
                  <div className="form-text text-end"><span role="button" onClick={() => this.setAvailableAmount()}>
                    Available: <Coins coins={this.props.availableBalance} asset={this.props.network.baseAsset} fullPrecision={true} hideValue={true} />
                  </span></div>
                }
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Memo</Form.Label>
              <Form.Control name="memo" as="textarea" rows={3} value={this.state.memo} onChange={this.handleInputChange} />
            </Form.Group>
            <p className="text-end">
              {!this.state.loading
                ? <Button type="submit" disabled={!this.hasPermission()} className="btn btn-primary">{this.actionText()}</Button>
                : <Button className="btn btn-primary" type="button" disabled>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                </Button>
              }
            </p>
          </fieldset>
        </Form>
      </>
    )
  }
}

export default DelegateForm
