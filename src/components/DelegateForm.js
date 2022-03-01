import React from 'react'
import Coins from './Coins'

import {
  coin
} from '@cosmjs/stargate'

import {
  Button,
  Form,
  Alert
} from 'react-bootstrap'

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

    const client = this.props.stargateClient
    const address = this.props.address
    const validatorAddress = this.props.selectedValidator.operator_address
    const amount = this.state.amount
    const memo = this.state.memo
    let msg
    let gas

    if(this.props.redelegate){
      gas = 300_000
      msg = {
        typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
        value: {
          delegatorAddress: address,
          validatorSrcAddress: this.props.validator.operator_address,
          validatorDstAddress: validatorAddress,
          amount: coin(parseFloat(amount) * 1000000, this.props.network.denom),
        }
      }
    }else{
      const msgType = this.props.undelegate ? 'MsgUndelegate' : 'MsgDelegate'
      msg = {
        typeUrl: "/cosmos.staking.v1beta1." + msgType,
        value: {
          delegatorAddress: address,
          validatorAddress: validatorAddress,
          amount: coin(parseFloat(amount) * 1000000, this.props.network.denom),
        }
      }
    }

    client.signAndBroadcast(address, [msg], gas, memo).then((result) => {
      console.log("Successfully broadcasted:", result);
      this.setState({loading: false, error: null})
      this.props.onDelegate()
    }, (error) => {
      console.log('Failed to broadcast:', error)
      this.setState({ loading: false, error: 'Failed to broadcast TX' })
    })
  }

  setAvailableAmount(){
    const saveTxFeeNum = (this.props.redelegate || this.props.undelegate) ? 0 : 10
    const gasPrice = this.props.stargateClient.getFee().amount[0].amount
    const amount = (this.props.availableBalance.amount - (gasPrice * saveTxFeeNum))
    this.setState({amount: amount / 1_000_000.0})
  }

  actionText(){
    if(this.props.redelegate) return 'Redelegate'
    if(this.props.undelegate) return 'Undelegate'
    if(this.props.validator){
      return 'Delegate'
    }else{
      return 'Add Validator'
    }
  }

  denom(){
    return this.props.network.denom.slice(1).toUpperCase()
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
          <Form.Group className="mb-3">
            <Form.Label>Amount</Form.Label>
            <div className="mb-3">
              <div className="input-group">
                <Form.Control name="amount" type="number" step={0.000001} placeholder="10" required={true} value={this.state.amount} onChange={this.handleInputChange} />
                <span className="input-group-text">{this.denom()}</span>
              </div>
              {this.props.availableBalance &&
              <div className="form-text text-end"><span role="button" onClick={() => this.setAvailableAmount()}>
                Available: <Coins coins={this.props.availableBalance} />
              </span></div>
              }
            </div>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Memo</Form.Label>
            <Form.Control name="memo" as="textarea" rows={3} value={this.state.memo} onChange={this.handleInputChange} />
          </Form.Group>
          {!this.state.loading
            ? <Button type="submit" className="btn btn-primary">{this.actionText()}</Button>
            : <Button className="btn btn-primary" type="button" disabled>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
              Submitting TX...
            </Button>
          }
        </Form>
      </>
    )
  }
}

export default DelegateForm
