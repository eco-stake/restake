import React from 'react'
import Delegations from './Delegations'
import AddValidator from './AddValidator'

class Wallet extends React.Component {
  constructor(props) {
    super(props);
    this.restUrl = process.env.REACT_APP_REST_URL
    this.botAddress = process.env.REACT_APP_BOT_ADDRESS
    this.state = {}

    this.onAddValidator = this.onAddValidator.bind(this);
  }

  async componentDidMount() {
    this.getDelegations()
    this.getGrants()
    this.getValidators()
  }

  componentWillUnmount() {
  }

  onAddValidator(){
    setTimeout(() => this.getDelegations(), 1000)
  }

  async getValidators() {
    fetch(this.restUrl + "/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=500")
      .then(res => res.json())
      .then(
        (result) => {
          const validators = result.validators.reduce((a, v) => ({ ...a, [v.operator_address]: v}), {})
          this.setState({ validators: validators });
        },
        (error) => {
          this.setState({ error });
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

  async getGrants() {
    const searchParams = new URLSearchParams();
    searchParams.append("grantee", this.botAddress);
    searchParams.append("granter", this.props.address);
    // searchParams.append("msg_type_url", "/cosmos.staking.v1beta1.MsgDelegate");
    fetch(this.restUrl + "/cosmos/authz/v1beta1/grants?" + searchParams.toString())
      .then(res => res.json())
      .then(
        (result) => {
          console.log(result)
          this.setState({ grants: result });
        },
        (error) => {
          this.setState({ error });
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
        <Delegations
          address={this.props.address}
          validators={this.state.validators}
          delegations={this.state.delegations}
          grants={this.state.grants}
          stargateClient={this.props.stargateClient} />
        <AddValidator
          address={this.props.address}
          validators={this.state.validators}
          delegations={this.state.delegations}
          stargateClient={this.props.stargateClient}
          onAddValidator={this.onAddValidator} />
      </div>
    )
  }
}

export default Wallet;
