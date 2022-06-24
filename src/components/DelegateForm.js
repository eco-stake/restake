import React from 'react'
import Coins from './Coins'
import { coin } from '../utils/Helpers.mjs'

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

    this.setState({loading: true})

    const address = this.props.address
    const amount = this.state.amount
    const memo = this.state.memo
    const client = this.props.stargateClient

    const decimals = pow(10, this.props.network.decimals)
    const denomAmount = bignumber(multiply(amount, decimals))

    let messages = this.buildMessages(denomAmount)
    let gas
    try {
       gas = await client.simulate(this.props.address, messages)
    } catch (error) {
      this.setState({ loading: false, error: error.message })
      return
    }

    client.signAndBroadcast(address, messages, gas, memo).then((result) => {
      console.log("Successfully broadcasted:", result);
      this.setState({loading: false, error: null})
      this.props.onDelegate()
    }, (error) => {
      console.log('Failed to broadcast:', error)
      this.setState({ loading: false, error: error.message })
    })
  }

  buildMessages(amount){
    const address = this.props.address
    const validatorAddress = this.props.selectedValidator.operator_address
    let messages = []
    if(this.props.redelegate){
      messages.push({
        typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
        value: {
          delegatorAddress: address,
          validatorSrcAddress: this.props.validator.operator_address,
          validatorDstAddress: validatorAddress,
          amount: coin(amount, this.props.network.denom)
        }
      })
    }else{
      const msgType = this.props.undelegate ? 'MsgUndelegate' : 'MsgDelegate'
      messages.push({
        typeUrl: "/cosmos.staking.v1beta1." + msgType,
        value: {
          delegatorAddress: address,
          validatorAddress: validatorAddress,
          amount: coin(amount, this.props.network.denom)
        }
      })
    }
    return messages
  }

  async setAvailableAmount(){
    this.setState({error: undefined})
    const messages = this.buildMessages(multiply(this.props.availableBalance.amount, 0.95))
    this.props.stargateClient.simulate(this.props.address, messages).then(gas => {
      const saveTxFeeNum = (this.props.redelegate || this.props.undelegate) ? 0 : 10
      const gasPrice = this.props.stargateClient.getFee(gas).amount[0].amount
      const decimals = pow(10, this.props.network.decimals || 6)
      const amount = divide(subtract(this.props.availableBalance.amount, multiply(gasPrice, saveTxFeeNum)), decimals)

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
    return this.props.network.symbol.toUpperCase()
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
          <fieldset disabled={!this.props.address}>
            <Form.Group className="mb-3">
              <Form.Label>Amount</Form.Label>
              <div className="mb-3">
                <div className="input-group">
                  <Form.Control name="amount" type="number" min={0} step={this.step()} placeholder="10" required={true} value={this.state.amount} onChange={this.handleInputChange} />
                  <span className="input-group-text">{this.denom()}</span>
                </div>
                {this.props.availableBalance &&
                  <div className="form-text text-end"><span role="button" onClick={() => this.setAvailableAmount()}>
                    Available: <Coins coins={this.props.availableBalance} decimals={this.props.network.decimals} />
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
                ? <Button type="submit" className="btn btn-primary">{this.actionText()}</Button>
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
