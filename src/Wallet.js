import React from 'react'
import Delegations from './Delegations'
import Validators from './Validators'

class Wallet extends React.Component {
  constructor(props) {
    super(props);
    this.restUrl = process.env.REACT_APP_REST_URL
    this.state = {}
  }

  async componentDidMount() {
    this.getValidators()
    this.getDelegations()
  }

  componentWillUnmount() {
  }

  async getValidators() {
    fetch(this.restUrl + "/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=500")
      .then(res => res.json())
      .then(
        (result) => {
          const validators = result.validators.reduce((a, v) => ({ ...a, [v.operator_address]: v}), {})
          this.setState({
            isLoaded: true,
            validators: validators
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

  async getDelegations() {
    fetch(this.restUrl + "/cosmos/staking/v1beta1/delegations/" + this.props.address)
      .then(res => res.json())
      .then(
        (result) => {
          const delegations = result.delegation_responses.reduce((a, v) => ({ ...a, [v.delegation.validator_address]: v}), {})
          this.setState({
            isLoaded: true,
            delegations: delegations
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
        <p>Loading...</p>
      )
    }
    if (this.state.error) {
      return (
        <p>Loading failed</p>
      )
    }
    return (
      <div>
        <h3>Delegations</h3>
        <Delegations
          address={this.props.address}
          validators={this.state.validators}
          delegations={this.state.delegations}
          stargateClient={this.props.stargateClient} />
        <h3>Validators</h3>
        <Validators
          validators={this.state.validators}
          delegations={this.state.delegations} />
      </div>
    )
  }
}

export default Wallet;
