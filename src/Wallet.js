import React from 'react'
import Delegations from './Delegations'

import {
  Spinner
} from 'react-bootstrap';

class Wallet extends React.Component {
  constructor(props) {
    super(props);
    this.botAddress = process.env.REACT_APP_BOT_ADDRESS
    this.state = {}
    this.getDelegations = this.getDelegations.bind(this);
    this.onAddValidator = this.onAddValidator.bind(this);
  }

  componentDidMount() {
    this.getDelegations()
  }

  componentDidUpdate(prevProps) {
    if(this.props.address !== prevProps.address){
      this.getDelegations()
    }
  }

  onAddValidator(){
    setTimeout(() => this.getDelegations(), 3_000)
  }

  async getDelegations() {
    this.props.restClient.getDelegations(this.props.address)
      .then(
        (delegations) => {
          this.setState({
            isLoaded: true,
            delegations: delegations,
            operatorDelegation: delegations[this.props.operator.operator_address]
          });
        },
        (error) => {
          this.setState({
            isLoaded: true,
            error
          });
        }
      )
  }

  render() {
    if (!this.state.isLoaded) {
      return (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )
    }
    if (this.state.error) {
      return (
        <p>Loading failed</p>
      )
    }
    return (
      <div className="mb-5">
        <Delegations
          operator={this.props.operator}
          address={this.props.address}
          validators={this.props.validators}
          delegations={this.state.delegations}
          operatorDelegation={this.state.operatorDelegation}
          restClient={this.props.restClient}
          stargateClient={this.props.stargateClient}
          getDelegations={this.getDelegations}
          onAddValidator={this.onAddValidator} />
      </div>
    )
  }
}

export default Wallet;
