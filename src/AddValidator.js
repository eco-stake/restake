import React from 'react'
import Validators from './Validators'

import {
  coin,
  MsgDelegateEncodeObject,
  calculateFee,
  assertIsDeliverTxSuccess,
  GasPrice
} from '@cosmjs/stargate'

import {
  Button,
  Modal,
  Form,
  Alert
} from 'react-bootstrap'

class AddValidator extends React.Component {
  constructor(props) {
    super(props);
    this.state = {show: false, validator: null, amount: '', memo: ''}

    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  show() {
    this.setState({show: true, validator: null})
  }

  hide() {
    this.setState({show: false})
  }

  selectValidator(validator) {
    this.setState({validator: validator})
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
    const validatorAddress = this.state.validator.operator_address
    const amount = this.state.amount
    const memo = this.state.memo
    const msg: MsgDelegateEncodeObject = {
      typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
      value: {
        delegatorAddress: address,
        validatorAddress: validatorAddress,
        amount: coin(parseFloat(amount) * 1000000.0, "uosmo"),
      },
    };
    const gasPrice = GasPrice.fromString("0.025uosmo");
    const fee = calculateFee(180_000, gasPrice);

    try {
      const result = await client.signAndBroadcast(address, [msg], fee, memo);
      console.log("Broadcast result:", result);

      assertIsDeliverTxSuccess(result);
      console.log("Successfully broadcasted:", result);

      this.setState({loading: false, error: null})
      client.disconnect();
      this.hide()
      this.props.onAddValidator()

    } catch (error) {
      console.log('Failed to broadcast:', error)
      this.setState({ loading: false, error: 'Failed to broadcast TX' })
    }
  }

  render() {
    return (
      <>
        <Button className="btn-secondary" onClick={() => this.show()}>
          Add Validator
        </Button>

        <Modal show={this.state.show} onHide={() => this.hide()}>
          <Modal.Header closeButton>
            <Modal.Title>Add Validator</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {!this.state.validator &&
              <Validators
                  validators={this.props.validators}
                  delegations={this.props.delegations}
                  selectValidator={(validator) => this.selectValidator(validator)} /> }
            {this.state.validator && (
              <>
                <p>Delegate to {this.state.validator.description.moniker}</p>
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
                      <span className="input-group-text">OSMO</span>
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
            )}
          </Modal.Body>
        </Modal>
      </>
    );
  }
}

export default AddValidator
