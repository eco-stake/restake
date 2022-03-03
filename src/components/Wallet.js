import React from 'react'
import Delegations from './Delegations'
import Coins from './Coins'

import Countdown from 'react-countdown';

import {
  Spinner
} from 'react-bootstrap';

class Wallet extends React.Component {
  constructor(props) {
    super(props);
    this.state = {}
    this.getDelegations = this.getDelegations.bind(this);
    this.onAddValidator = this.onAddValidator.bind(this);
    this.countdownRenderer = this.countdownRenderer.bind(this);
  }

  componentDidMount() {
    this.getDelegations()
    this.refreshInterval()
  }

  componentDidUpdate(prevProps) {
    if(this.props.address !== prevProps.address){
      this.getDelegations()
      this.refreshInterval()
    }
  }

  componentWillUnmount(){
    clearInterval(this.state.refreshInterval);
  }

  refreshInterval(){
    clearInterval(this.state.refreshInterval);
    const interval = setInterval(() => {
      this.getDelegations()
    }, 30_000)
    this.setState({refreshInterval: interval})
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
          });
        },
        (error) => {
          if([404, 500].includes(error.response.status)){
            this.setState({
              isLoaded: true,
              delegations: {},
            });
          }else{
            this.setState({
              isLoaded: true,
              error
            });
          }
        }
      )
  }

  minimumReward(){
    const operator = this.props.operator

    if(operator){
      return {amount: operator.data.minimumReward, denom: this.props.network.denom}
    }
  }

  nextRun(operator, delayHour){
    const now = new Date()
    if(!operator || !operator.data.runTime){
      return null
    }
    const runTime = operator.data.runTime.split(':')
    let day
    if(delayHour){
      day = now.getHours() > runTime[0] ? now.getDate() + 1 : now.getDate()
    }else{
      day = now.getHours() >= runTime[0] ? now.getDate() + 1 : now.getDate()
    }

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      day,
      runTime[0],
      runTime[1],
      runTime[2] || 0
    )
  }

  countdownRenderer({ hours, minutes, seconds, completed }){
    if (completed) {
      return <p>Auto REStake is running right now. The next run will be at {this.state.runTime} tomorrow</p>
    } else {
      let string = ''
      if(hours > 0) string = string.concat(hours + ' hours, ')
      if(minutes > 0) string = string.concat(minutes + ' minutes and ')
      string = string.concat(seconds + ' seconds')
      return (
        <p>Auto REStake will run in <span>{string}</span></p>
      )
    }
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
          getValidatorImage={this.props.getValidatorImage}
          delegations={this.state.delegations}
          restClient={this.props.restClient}
          stargateClient={this.props.stargateClient}
          getDelegations={this.getDelegations}
          onAddValidator={this.onAddValidator} />
        {false && this.props.operator && Object.values(this.state.delegations).length > 0 &&
        <div className="mt-5 text-center">
          <Countdown
            date={this.nextRun(true)}
            renderer={this.countdownRenderer}
          />
          <p><em>The minimum reward is <Coins coins={this.minimumReward()} /></em></p>
        </div>
        }
      </div>
    )
  }
}

export default Wallet;
