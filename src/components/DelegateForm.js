import React from "react";

import { coin } from "@cosmjs/stargate";

import { Button, Form, Alert } from "react-bootstrap";
import Coins from "./Coins";

class DelegateForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = { amount: "", memo: "" };

    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleInputChange(event) {
    const { target } = event;
    const { value } = target;
    const { name } = target;

    this.setState({
      [name]: value,
    });
  }

  async handleSubmit(event) {
    event.preventDefault();

    this.setState({ loading: true });

    const { address } = this.props;
    const { amount } = this.state;
    const { memo } = this.state;
    const client = this.props.stargateClient;

    const messages = this.buildMessages(amount);
    let gas;
    try {
      gas = await client.simulate(this.props.address, messages);
    } catch (error) {
      this.setState({ loading: false, error: error.message });
      return;
    }

    client.signAndBroadcast(address, messages, gas, memo).then(
      (result) => {
        console.log("Successfully broadcasted:", result);
        this.setState({ loading: false, error: null });
        this.props.onDelegate();
      },
      (error) => {
        console.log("Failed to broadcast:", error);
        this.setState({ loading: false, error: error.message });
      }
    );
  }

  async setAvailableAmount() {
    this.setState({ error: undefined });
    const decimals = 10 ** (this.props.network.data.decimals || 6);
    const messages = this.buildMessages(
      parseInt(this.props.availableBalance.amount * 0.95) / decimals
    );
    this.props.stargateClient.simulate(this.props.address, messages).then(
      (gas) => {
        const saveTxFeeNum =
          this.props.redelegate || this.props.undelegate ? 0 : 10;
        const gasPrice = this.props.stargateClient.getFee(gas).amount[0].amount;
        const amount =
          (this.props.availableBalance.amount - gasPrice * saveTxFeeNum) /
          decimals;

        this.setState({ amount: amount > 0 ? amount : 0 });
      },
      (error) => {
        this.setState({ error: error.message });
      }
    );
  }

  buildMessages(amount) {
    const { address } = this.props;
    const validatorAddress = this.props.selectedValidator.operator_address;
    const messages = [];
    const decimals = 10 ** (this.props.network.data.decimals || 6);
    if (this.props.redelegate) {
      messages.push({
        typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
        value: {
          delegatorAddress: address,
          validatorSrcAddress: this.props.validator.operator_address,
          validatorDstAddress: validatorAddress,
          amount: coin(
            parseInt(parseFloat(amount) * decimals),
            this.props.network.denom
          ),
        },
      });
    } else {
      const msgType = this.props.undelegate ? "MsgUndelegate" : "MsgDelegate";
      messages.push({
        typeUrl: `/cosmos.staking.v1beta1.${msgType}`,
        value: {
          delegatorAddress: address,
          validatorAddress,
          amount: coin(
            parseInt(parseFloat(amount) * decimals),
            this.props.network.denom
          ),
        },
      });
    }
    return messages;
  }

  actionText() {
    if (this.props.redelegate) return "Redelegate";
    if (this.props.undelegate) return "Undelegate";
    return "Delegate";
  }

  denom() {
    return this.props.network.denom.slice(1).toUpperCase();
  }

  render() {
    return (
      <>
        {this.state.error && <Alert variant="danger">{this.state.error}</Alert>}
        <Form onSubmit={this.handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Amount</Form.Label>
            <div className="mb-3">
              <div className="input-group">
                <Form.Control
                  name="amount"
                  type="number"
                  step={0.000001}
                  placeholder="10"
                  required
                  value={this.state.amount}
                  onChange={this.handleInputChange}
                />
                <span className="input-group-text">{this.denom()}</span>
              </div>
              {this.props.availableBalance && (
                <div className="form-text text-end">
                  <span role="button" onClick={() => this.setAvailableAmount()}>
                    Available:{" "}
                    <Coins
                      coins={this.props.availableBalance}
                      decimals={this.props.network.data.decimals}
                    />
                  </span>
                </div>
              )}
            </div>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Memo</Form.Label>
            <Form.Control
              name="memo"
              as="textarea"
              rows={3}
              value={this.state.memo}
              onChange={this.handleInputChange}
            />
          </Form.Group>
          {!this.state.loading ? (
            <Button type="submit" className="btn btn-primary">
              {this.actionText()}
            </Button>
          ) : (
            <Button className="btn btn-primary" type="button" disabled>
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              />
              &nbsp;
            </Button>
          )}
        </Form>
      </>
    );
  }
}

export default DelegateForm;
