import React from 'react'
import _ from 'lodash'
import Coins from './Coins'
import AddValidator from './AddValidator'

import {
  coin,
  calculateFee,
  assertIsDeliverTxSuccess,
  GasPrice
} from '@cosmjs/stargate'
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { StakeAuthorization } from "cosmjs-types/cosmos/staking/v1beta1/authz";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";

import {
  Table,
  Button
} from 'react-bootstrap'

class Delegations extends React.Component {
  constructor(props) {
    super(props);
    this.restUrl = process.env.REACT_APP_REST_URL
    this.botAddress = process.env.REACT_APP_BOT_ADDRESS
    this.maxValidators = process.env.REACT_APP_MAX_VALIDATORS
    this.state = {restake: [], grantValidators: []}
  }

  componentDidMount() {
    this.getGrants()
    this.getRewards()
  }

  componentDidUpdate(prevProps){
    if(this.props.address !== prevProps.address){
      this.getGrants()
      this.getRewards()
    }
  }

  componentWillUnmount() {
  }

  getRewards() {
    fetch(this.restUrl + "/cosmos/distribution/v1beta1/delegators/" + this.props.address + "/rewards")
      .then(res => res.json())
      .then(
        (result) => {
          const rewards = result.rewards.reduce((a, v) => ({ ...a, [v.validator_address]: v}), {})
          this.setState({ rewards: rewards });
        },
        (error) => {
          this.setState({ error });
        }
      )
  }

  getGrants() {
    const searchParams = new URLSearchParams();
    searchParams.append("grantee", this.botAddress);
    searchParams.append("granter", this.props.address);
    // searchParams.append("msg_type_url", "/cosmos.staking.v1beta1.MsgDelegate");
    fetch(this.restUrl + "/cosmos/authz/v1beta1/grants?" + searchParams.toString())
      .then(res => res.json())
      .then(
        (result) => {
          const claimGrant = result.grants.find(el => {
            return el.authorization['@type'] === "/cosmos.authz.v1beta1.GenericAuthorization" && el.authorization.msg === "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
          })
          const stakeGrant = result.grants.find(el => {
            return el.authorization['@type'] === "/cosmos.staking.v1beta1.StakeAuthorization"
          })
          let grantValidators
          if(stakeGrant){
            grantValidators = stakeGrant.authorization.allow_list.address
          }
          this.setState({
            claimGrant: claimGrant,
            stakeGrant: stakeGrant,
            grantValidators: grantValidators || [],
            restake: grantValidators || []
          })
        },
        (error) => {
          this.setState({ error });
        }
      )
  }

  buildGrantMsg(type, value){
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
      value: {
        granter: this.props.address,
        grantee: this.botAddress,
        grant: {
          authorization: {
            typeUrl: type,
            value: value
          },
          // expiration: undefined
        }
      },
    }
  }

  async manualRestake() {
    this.setState({manualLoading: true})

    const client = this.props.stargateClient
    const address = this.props.address
    const totalRewards = this.totalRewards()
    const perValidatorReward = totalRewards.amount / this.state.restake.length
    let messages = this.state.restake.map(el => {
      return [{
        typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
        value: MsgWithdrawDelegatorReward.fromPartial({
          delegatorAddress: this.props.address,
          validatorAddress: el
        })
      }, {
        typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
        value: MsgDelegate.fromPartial({
          delegatorAddress: this.props.address,
          validatorAddress: el,
          amount: coin(perValidatorReward, 'uosmo')
        })
      }]
    }).flat()
    console.log(messages)

    const gasPrice = GasPrice.fromString("0.025uosmo");
    const fee = calculateFee(600_000, gasPrice);

    try {
      const result = await client.signAndBroadcast(address, messages, fee);
      console.log("Broadcast result:", result);

      assertIsDeliverTxSuccess(result);
      console.log("Successfully broadcasted:", result);

      this.setState({manualLoading: false, error: null})
      client.disconnect();

      setTimeout(() => this.props.getDelegations(), 3000)

    } catch (error) {
      console.log('Failed to broadcast:', error)
      this.setState({ manualLoading: false, error: 'Failed to broadcast TX' })
    }
  }

  async updateRestake() {
    this.setState({updateLoading: true})

    const client = this.props.stargateClient
    const address = this.props.address
    const validatorAddresses = this.state.restake
    const messages = [
      this.buildGrantMsg("/cosmos.staking.v1beta1.StakeAuthorization",
        StakeAuthorization.encode(StakeAuthorization.fromPartial({
          allowList: {address: validatorAddresses},
          authorizationType: 1
        })).finish(),
      ),
      this.buildGrantMsg("/cosmos.authz.v1beta1.GenericAuthorization",
        GenericAuthorization.encode(GenericAuthorization.fromPartial({
          msg: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward'
        })).finish(),
      )
    ]
    console.log(messages)

    const gasPrice = GasPrice.fromString("0.025uosmo");
    const fee = calculateFee(180_000, gasPrice);

    try {
      const result = await client.signAndBroadcast(address, messages, fee);
      console.log("Broadcast result:", result);

      assertIsDeliverTxSuccess(result);
      console.log("Successfully broadcasted:", result);

      this.setState({updateLoading: false, error: null})
      client.disconnect();

      setTimeout(() => this.getGrants(), 3000)

    } catch (error) {
      console.log('Failed to broadcast:', error)
      this.setState({ updateLoading: false, error: 'Failed to broadcast TX' })
    }
  }

  addToRestake(validatorAddress) {
    this.setState((state) => ({
      restake: [...state.restake, validatorAddress]
    }));
  }

  removeFromRestake(validatorAddress) {
    this.setState((state) => ({
      restake: state.restake.filter(el => el !== validatorAddress)
    }));
  }

  restakeChanged(){
    return !_.isEqual(this.state.restake, this.state.grantValidators)
  }

  restakeIncludes(validatorAddress){
    return this.state.restake.includes(validatorAddress)
  }

  restakePercentage(validatorAddress){
    if(this.restakeIncludes(validatorAddress)){
      return _.round(100.0 / this.state.restake.length)
    }else{
      return 0
    }
  }

  totalRewards(){
    if(!this.state.rewards) return;

    const total = Object.values(this.state.rewards).reduce((sum, item) => {
      const reward = item.reward.find(el => el.denom === 'uosmo')
      if(reward && this.state.restake.includes(item.validator_address)){
        return sum + parseInt(reward.amount)
      }
      return sum
    }, 0)
    return {
      amount: total,
      denom: 'uosmo'
    }
  }

  render() {
    if (!this.props.delegations || !this.props.validators) {
      return (
        <p>Loading...</p>
      )
    }

    if (Object.values(this.props.delegations).length < 1){
      return (
        <div className="text-center">
          <p>You have no delegations yet. Stake to a validator first to setup REStake.</p>
          <AddValidator
            address={this.props.address}
            validators={this.props.validators}
            delegations={this.props.delegations}
            stargateClient={this.props.stargateClient}
            onAddValidator={this.props.onAddValidator} />
        </div>
      )
    }

    const listItems = this.props.delegations && Object.entries(this.props.delegations).map(([validator_address, item], i) => {
      const validator = this.props.validators[item.delegation.validator_address]
      const rewards = this.state.rewards && this.state.rewards[item.delegation.validator_address]
      if(validator)
        return (
          <tr key={validator.operator_address}>
            <td>{validator.description.moniker}</td>
            <td></td>
            <td><Coins coins={item.balance} /></td>
            <td>{rewards && rewards.reward.map(el => <Coins key={el.denom} coins={el} />)}</td>
            <td>
              {this.restakePercentage(validator.operator_address)}%
            </td>
            <td>
              {this.state.restake.includes(validator.operator_address)
                ? <Button className="btn-sm btn-secondary float-end" onClick={() => this.removeFromRestake(validator.operator_address)}>
                  Remove from REStake
                </Button>
                : this.state.restake.length < this.maxValidators && (
                  <Button className="btn-sm float-end" disabled={this.state.restake.length >= this.maxValidators} onClick={() => this.addToRestake(validator.operator_address)}>
                    Add to REStake
                  </Button>
                )
              }
            </td>
          </tr>
        )
      else
        return ''
    })

    return (
      <>
        <Table>
          <thead>
            <tr>
              <th>Validator</th>
              <th>APY</th>
              <th>Delegation</th>
              <th>Rewards</th>
              <th>Restake %</th>
              <th width={200}>
              </th>
            </tr>
          </thead>
          <tbody>
            {listItems}
          </tbody>
        </Table>
        <div className="row">
          <div className="col">
            <AddValidator
              address={this.props.address}
              validators={this.props.validators}
              delegations={this.props.delegations}
              stargateClient={this.props.stargateClient}
              onAddValidator={this.props.onAddValidator} />
          </div>
          <div className="col">
            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              {this.restakeChanged() && (
                !this.state.updateLoading
                  ? <Button className="mr-5" onClick={() => this.updateRestake()}>Update Restake</Button>
                  : <Button className="btn btn-primary" type="button" disabled>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                    Submitting TX...
                  </Button>
              )}
              {!this.restakeChanged() && this.state.restake.length > 0 && (
                !this.state.manualLoading
                  ? <Button className="btn-secondary mr-5" onClick={() => this.manualRestake()}>Restake <Coins coins={this.totalRewards()} /></Button>
                  : <Button className="btn btn-primary" type="button" disabled>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                    Submitting TX...
                  </Button>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }
}

export default Delegations;
