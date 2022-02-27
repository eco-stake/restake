import React from 'react'

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
    const validatorAddress = this.props.validator.operator_address
    const amount = this.state.amount
    const memo = this.state.memo
    const msg = {
      typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
      value: {
        delegatorAddress: address,
        validatorAddress: validatorAddress,
        amount: coin(parseFloat(amount) * 1000000, this.props.network.denom),
      }
    }

    client.signAndBroadcast(address, [msg], undefined, memo).then((result) => {
      console.log("Successfully broadcasted:", result);
      this.setState({loading: false, error: null})
      this.props.onDelegate()
    }, (error) => {
      console.log('Failed to broadcast:', error)
      this.setState({ loading: false, error: 'Failed to broadcast TX' })
    })
  }

  denom(){
    return this.props.network.denom.slice(1).toUpperCase()
  }

  render() {
    return (
      <>
        <p>Delegate to {this.props.validator.description.moniker}</p>
        {this.state.error &&
        <Alert variant="danger">
          {this.state.error}
        </Alert>
        }
        <Form onSubmit={this.handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Amount</Form.Label>
            <div className="input-group mb-3">
              <Form.Control name="amount" type="number" step={0.000001} placeholder="10" required={true} value={this.state.amount} onChange={this.handleInputChange} />
              <span className="input-group-text">{this.denom()}</span>
            </div>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Memo</Form.Label>
            <Form.Control name="memo" as="textarea" rows={3} value={this.state.memo} onChange={this.handleInputChange} />
          </Form.Group>
          {!this.state.loading
            ? <Button type="submit" className="btn btn-primary">Delegate</Button>
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
