import React from 'react'
import Delegations from './Delegations'

import {
  Spinner
} from 'react-bootstrap';

class Wallet extends React.Component {
  constructor(props) {
    super(props);
    this.state = {}
    this.getDelegations = this.getDelegations.bind(this);
    this.onAddValidator = this.onAddValidator.bind(this);
  }

  componentDidMount() {
    this.getDelegations()
    this.refreshInterval()
  }

  componentDidUpdate(prevProps) {
    if(this.props.network !== prevProps.network){
      clearInterval(this.state.refreshInterval);
      this.setState({ delegations: undefined })
    }

    if (!this.props.address) return
    if(this.props.address !== prevProps.address){
      this.getDelegations()
      this.refreshInterval()
    }
  }

  componentWillUnmount(){
    clearInterval(this.state.refreshInterval);
  }

  refreshInterval(){
    const interval = setInterval(() => {
      this.getDelegations(true)
    }, 30_000)
    this.setState({refreshInterval: interval})
  }

  onAddValidator(){
    setTimeout(() => this.getDelegations(), 3_000)
  }

  async getDelegations(hideError) {
    this.props.queryClient.getDelegations(this.props.address)
      .then(
        (delegations) => {
          const orderedAddresses = Object.keys(this.props.validators)
          delegations = orderedAddresses.reduce((sum, address) => {
            if(delegations[address]) sum[address] = delegations[address]
            return sum
          }, {})
          this.setState({
            isLoaded: true,
            delegations: delegations,
          });
        },
        (error) => {
          this.setState({ isLoaded: true })
          if([404, 500].includes(error.response && error.response.status)){
            this.setState({
              delegations: {}
            });
          }else if(!hideError){
            this.setState({
              error: 'Failed to load delegations. Please refresh.'
            });
          }
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
          network={this.props.network}
          address={this.props.address}
          balance={this.props.balance}
          operators={this.props.operators}
          validators={this.props.validators}
          getBalance={this.props.getBalance}
          delegations={this.state.delegations}
          queryClient={this.props.queryClient}
          stargateClient={this.props.stargateClient}
          getDelegations={this.getDelegations}
          onAddValidator={this.onAddValidator} />
      </div>
    )
  }
}

export default Wallet;
