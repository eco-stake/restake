import React from 'react'
import _ from 'lodash'
import AlertMessage from './AlertMessage'
import Coins from './Coins'
import AddValidator from './AddValidator'
import ClaimRewards from './ClaimRewards'
import RevokeRestake from './RevokeRestake'
import UpdateRestake from './UpdateRestake'
import Delegate from './Delegate'

import {
  Table,
  Button,
  Dropdown,
  Spinner
} from 'react-bootstrap'

import {
  CheckCircle, XCircle
} from 'react-bootstrap-icons'

class Delegations extends React.Component {
  constructor(props) {
    super(props);
    this.botAddress = process.env.REACT_APP_BOT_ADDRESS
    this.maxValidators = process.env.REACT_APP_MAX_VALIDATORS
    this.state = {restake: [], grantValidators: [], validatorLoading: {}}

    this.setError = this.setError.bind(this)
    this.setClaimLoading = this.setClaimLoading.bind(this)
    this.onUpdateRestake = this.onUpdateRestake.bind(this)
    this.onClaimRewards = this.onClaimRewards.bind(this)
    this.onRevoke = this.onRevoke.bind(this)
  }

  async componentDidMount() {
    const isNanoLedger = this.props.stargateClient.getIsNanoLedger()
    this.setState({ isNanoLedger: isNanoLedger })
    this.getGrants()
    this.getRewards()
  }

  async componentDidUpdate(prevProps){
    if(this.props.address !== prevProps.address){
      const isNanoLedger = this.props.stargateClient.getIsNanoLedger()
      this.setState({ isNanoLedger: isNanoLedger })
      this.getGrants()
      this.getRewards()
    }
  }

  getRewards() {
    this.props.restClient.getRewards(this.props.address)
      .then(
        (rewards) => {
          this.setState({ rewards: rewards });
        },
        (error) => {
          this.setState({ error });
        }
      )
  }

  getGrants() {
    this.props.restClient.getGrants(this.botAddress, this.props.address)
      .then(
        (result) => {
          let grantValidators
          if(result.stakeGrant){
            grantValidators = result.stakeGrant.authorization.allow_list.address
          }
          this.setState({
            claimGrant: result.claimGrant,
            stakeGrant: result.stakeGrant,
            grantsValid: !!(result.claimGrant && result.stakeGrant),
            grantsExist: !!(result.claimGrant || result.stakeGrant),
            grantValidators: grantValidators || [],
            restake: grantValidators || []
          })
        },
        (error) => {
          this.setState({ error });
        }
      )
  }

  onUpdateRestake(){
    this.setState({
      grantValidators: this.state.restake,
      grantsValid: true,
      grantsExist: true,
      error: null
    })
    setTimeout(() => this.getGrants(), 10_000)
  }

  onRevoke() {
    this.setState({
      claimGrant: null,
      stakeGrant: null,
      grantsValid: false,
      grantsExist: false,
      grantValidators: [],
      restake: [],
      error: null
    })
  }

  onClaimRewards(){
    this.setState({claimLoading: false, validatorLoading: {}, error: null})
    setTimeout(() => {
      this.props.getDelegations()
      this.getRewards()
    }, 5_000)
  }

  setClaimLoading(value){
    if(value) this.setState({error: null})
    this.setState({claimLoading: !!value})
  }

  setValidatorLoading(validatorAddress, value){
    if(value) this.setState({error: null})
    const loading = this.state.validatorLoading
    loading[validatorAddress] = !!value
    this.setState({validatorLoading: loading})
  }

  setError(error){
    this.setState({ error: error })
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

  restakeEnabled(){
    return !this.state.isNanoLedger && !!this.props.operatorDelegation
  }

  restakeChanged(){
    if(!this.restakeEnabled()) return false

    return !_.isEqual(this.state.restake.sort(), this.state.grantValidators.sort())
  }

  restakeIncludes(validatorAddress){
    return this.state.restake.includes(validatorAddress)
  }

  totalRewards(validators){
    if(!this.state.rewards) return;

    const total = Object.values(this.state.rewards).reduce((sum, item) => {
      const reward = item.reward.find(el => el.denom === 'uosmo')
      if(reward && (validators === undefined || validators.includes(item.validator_address))){
        return sum + parseInt(reward.amount)
      }
      return sum
    }, 0)
    return {
      amount: total,
      denom: 'uosmo'
    }
  }

  renderDelegation(validatorAddress, item, variant){
    const validator = this.props.validators[validatorAddress]
    const rewards = this.state.rewards && this.state.rewards[validatorAddress]
    variant = variant ? 'table-' + variant : ''
    if(validator)
      return (
        <tr key={validator.operator_address} className={variant}>
        {/* <tr key={validator.operator_address} className={this.restakeIncludes(validator.operator_address) ? 'table-active ' + variant : variant}> */}
          <td>{validator.description.moniker}</td>
          <td>{validator.commission.commission_rates.rate * 100}%</td>
          <td></td>
          <td><Coins coins={item.balance} /></td>
          <td>{rewards && rewards.reward.map(el => <Coins key={el.denom} coins={el} />)}</td>
          <td>
            {this.restakeIncludes(validator.operator_address) ? <CheckCircle /> : <XCircle className="opacity-25" />}
          </td>
          <td>
            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              {!this.state.validatorLoading[validator.operator_address]
                ? (
                  <Dropdown>
                    <Dropdown.Toggle variant="secondary" size="sm" id="dropdown-basic">
                      Manage
                    </Dropdown.Toggle>

                    <Dropdown.Menu>
                      {this.restakeEnabled() && (
                        this.restakeIncludes(validator.operator_address)
                          ? <Dropdown.Item onClick={() => this.removeFromRestake(validator.operator_address)}>Disable REStake</Dropdown.Item>
                          : <Dropdown.Item  disabled={this.state.restake.length >= this.maxValidators} onClick={() => this.addToRestake(validator.operator_address)}>Enable REStake</Dropdown.Item>
                      )}
                      {this.restakeEnabled() && <hr />}
                      <ClaimRewards
                        restake={true}
                        address={this.props.address}
                        validators={[validator.operator_address]}
                        rewards={this.totalRewards([validator.operator_address])}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={(loading) => this.setValidatorLoading(validator.operator_address, loading)}
                        setError={this.setError} />
                      <ClaimRewards
                        address={this.props.address}
                        validators={[validator.operator_address]}
                        rewards={this.totalRewards([validator.operator_address])}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={(loading) => this.setValidatorLoading(validator.operator_address, loading)}
                        setError={this.setError} />
                      <hr />
                      <Delegate
                        address={this.props.address}
                        validator={validator}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards} />
                      <Dropdown.Item disabled={true} title="Coming soon" onClick={() => this.redelegate(validator.operator_address)}>Redelegate</Dropdown.Item>
                      <Dropdown.Item disabled={true} title="Coming soon" onClick={() => this.undelegate(validator.operator_address)}>Undelegate</Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                ) : (
                  <Button className="btn-sm btn-secondary mr-5" disabled>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                    Submitting TX...
                  </Button>
                )
              }
            </div>
          </td>
        </tr>
      )
    else
      return ''
  }

  render() {
    if (!this.props.delegations || !this.props.validators) {
      return (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      )
    }

    if (Object.values(this.props.delegations).length < 1){
      return (
        <>
          <div className="text-center">
            <p>You have no delegations yet. Stake to a validator first to setup REStake.</p>
            <AddValidator
              operator={this.props.operator}
              address={this.props.address}
              validators={this.props.validators}
              delegations={this.props.delegations}
              operatorDelegation={this.props.operatorDelegation}
              stargateClient={this.props.stargateClient}
              onAddValidator={this.props.onAddValidator} />
          </div>
        </>
      )
    }

    return (
      <>
        {this.state.isNanoLedger &&
        <AlertMessage variant="warning" message="Ledger devices are unable to send authz transactions right now. We will support as soon as possible, and you can manually restake for now." />
        }
        {this.restakeChanged() &&
        <AlertMessage variant="primary" message="You have changed your validator selection, make sure to update your authz grants using the button below." />
        }
        <AlertMessage message={this.state.error} />
        <Table className="table-hover">
          <thead>
            <tr>
              <th>Validator</th>
              <th>Commission</th>
              <th>APY</th>
              <th>Delegation</th>
              <th>Rewards</th>
              <th>REStake</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {this.props.operatorDelegation && (
              this.renderDelegation(this.props.operator.operator_address, this.props.operatorDelegation, 'primary')
            )}
            {this.props.delegations && (
              Object.entries(_.omit(this.props.delegations, this.props.operator.operator_address)).map(([validatorAddress, item], i) => {
                return this.renderDelegation(validatorAddress, item)
              })
            )}
          </tbody>
        </Table>
        <div className="row">
          <div className="col">
            <AddValidator
              operator={this.props.operator}
              address={this.props.address}
              validators={this.props.validators}
              delegations={this.props.delegations}
              operatorDelegation={this.props.operatorDelegation}
              stargateClient={this.props.stargateClient}
              onAddValidator={this.props.onAddValidator} />
          </div>
          <div className="col">
            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              {!this.restakeChanged() && this.state.rewards && this.totalRewards().amount > 0 && (
                !this.state.claimLoading
                  ? (
                    <Dropdown>
                      <Dropdown.Toggle variant="secondary" id="claim-dropdown">
                        Claim Rewards
                      </Dropdown.Toggle>

                      <Dropdown.Menu>
                        <ClaimRewards
                          restake={true}
                          address={this.props.address}
                          validators={this.state.restake}
                          rewards={this.totalRewards(this.state.restake)}
                          stargateClient={this.props.stargateClient}
                          onClaimRewards={this.onClaimRewards}
                          setLoading={this.setClaimLoading}
                          setError={this.setError} />
                        <ClaimRewards
                          address={this.props.address}
                          validators={Object.entries(this.props.validators)}
                          rewards={this.totalRewards()}
                          stargateClient={this.props.stargateClient}
                          onClaimRewards={this.onClaimRewards}
                          setLoading={this.setClaimLoading}
                          setError={this.setError} />
                      </Dropdown.Menu>
                    </Dropdown>
                  ) : (
                    <Button className="btn-secondary mr-5" disabled>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>&nbsp;
                      Submitting TX...
                    </Button>
                  )
              )}
              {!this.restakeChanged() && this.state.grantsExist && (
                <RevokeRestake
                  address={this.props.address}
                  botAddress={this.botAddress}
                  stargateClient={this.props.stargateClient}
                  onRevoke={this.onRevoke}
                  setError={this.setError} />
              )}
              {this.restakeChanged() && (
                <UpdateRestake
                  address={this.props.address}
                  botAddress={this.botAddress}
                  validators={this.state.restake}
                  stargateClient={this.props.stargateClient}
                  onUpdateRestake={this.onUpdateRestake}
                  setError={this.setError} />
              )}
            </div>
          </div>
        </div>
      </>
    )
  }
}

export default Delegations;
