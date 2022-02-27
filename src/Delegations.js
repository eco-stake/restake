import React from 'react'
import _ from 'lodash'
import AlertMessage from './AlertMessage'
import Coins from './Coins'
import AddValidator from './AddValidator'
import ClaimRewards from './ClaimRewards'
import RevokeRestake from './RevokeRestake'
import UpdateRestake from './UpdateRestake'
import Delegate from './Delegate'
import ValidatorImage from './ValidatorImage'

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
    this.refresh()
  }

  async componentDidUpdate(prevProps){
    if(!this.props.address) return

    if(this.props.address !== prevProps.address){
      const isNanoLedger = this.props.stargateClient.getIsNanoLedger()
      this.setState({ isNanoLedger: isNanoLedger, authzMissing: false, error: null })
      this.refresh()
    }else{
      if(this.props.operator !== prevProps.operator && this.props.network === prevProps.network){
        if(this.props.operator){
          this.getGrants()
        }
      }
    }
  }

  refresh(){
    this.getRewards()
    if(this.props.operator){
      this.getGrants()
    }else{
      this.getGrants(this.props.network.data.testAddress)
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

  getGrants(botAddress) {
    if(this.state.authzMissing) return
    if(!botAddress) botAddress = this.props.operator.botAddress
    this.props.restClient.getGrants(botAddress, this.props.address)
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
        }, (error) => {
          if (error.response.status === 501) {
            this.setState({ authzMissing: true });
          }else{
            this.setState({ error });
          }
        })
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
    return !this.state.isNanoLedger && !this.state.authzMissing && !!this.props.operator && !!this.props.operatorDelegation
  }

  restakeChanged(){
    if(!this.restakeEnabled()) return false
    if(!this.restakeIncludes(this.props.operator.address)) return false

    return !_.isEqual(this.state.restake.sort(), this.state.grantValidators.sort())
  }

  restakeIncludes(validatorAddress){
    return this.state.restake.includes(validatorAddress)
  }

  canAddToRestake(validatorAddress){
    return this.state.restake.length < this.props.operator.data.maxValidators &&
      (this.props.operator.address === validatorAddress || this.restakeIncludes(this.props.operator.address))
  }

  canRemoveFromRestake(validatorAddress){
    return this.state.restake.length === 1 || this.props.operator.address !== validatorAddress
  }

  validatorIsOperator(validatorAddress){
    if(!this.restakeEnabled()) return false

    return this.props.operator.address === validatorAddress
  }

  totalRewards(validators){
    if(!this.state.rewards) return;

    const denom = this.props.network.denom
    const total = Object.values(this.state.rewards).reduce((sum, item) => {
      const reward = item.reward.find(el => el.denom === denom)
      if(reward && (validators === undefined || validators.includes(item.validator_address))){
        return sum + parseInt(reward.amount)
      }
      return sum
    }, 0)
    return {
      amount: total,
      denom: denom
    }
  }

  otherDelegations(){
    if(!this.props.operator) return this.props.delegations

    return _.omit(this.props.delegations, this.props.operator.address)
  }

  renderDelegation(validatorAddress, item){
    const validator = this.props.validators[validatorAddress]
    const rewards = this.state.rewards && this.state.rewards[validatorAddress]
    let rowVariant = this.validatorIsOperator(validatorAddress) ? 'table-warning' : undefined
    let addButton = {}
    let removeButton = {}
    if(this.restakeEnabled()){
      addButton = {variant: 'outline-secondary', disabled: !this.canAddToRestake(validatorAddress)}
      removeButton = {variant: 'outline-danger', disabled: !this.canRemoveFromRestake(validatorAddress)}
      if(this.validatorIsOperator(validatorAddress)){
        if(!addButton.disabled) addButton.variant = 'primary'
      }else{
        if(this.restakeIncludes(validatorAddress)){
          rowVariant = 'table-secondary'
          if(!addButton.disabled) addButton.variant = 'outline-primary'
        }
      }
    }
    if(validator){
      return (
        <tr key={validatorAddress} className={rowVariant}>
          <td width={30}><ValidatorImage validator={validator} imageUrl={this.props.validatorImages[this.props.network.name][validatorAddress]} width={30} height={30} /></td>
          <td>{validator.description.moniker}</td>
          <td>{validator.commission.commission_rates.rate * 100}%</td>
          <td></td>
          <td><Coins coins={item.balance} /></td>
          <td>{rewards && rewards.reward.map(el => <Coins key={el.denom} coins={el} />)}</td>
          {this.restakeEnabled() &&
          <td>
            {false && (this.restakeIncludes(validatorAddress) ? <CheckCircle /> : <XCircle className="opacity-25" />)}
            {this.restakeIncludes(validatorAddress)
              ? (
                <Button size="sm" disabled={removeButton.disabled}
                  variant={removeButton.variant}
                  onClick={() => this.removeFromRestake(validatorAddress)}>Disable</Button>
              ) : (
                <Button size="sm" disabled={addButton.disabled}
                  variant={addButton.variant}
                  onClick={() => this.addToRestake(validatorAddress)}>Enable</Button>)
            }
          </td>
          }
          <td>
            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              {!this.state.validatorLoading[validatorAddress]
                ? (
                  <Dropdown>
                    <Dropdown.Toggle variant="secondary" size="sm" id="dropdown-basic">
                      Manage
                    </Dropdown.Toggle>

                    <Dropdown.Menu>
                      {this.restakeEnabled() && (
                        this.restakeIncludes(validatorAddress)
                          ? <Dropdown.Item disabled={!this.canRemoveFromRestake(validatorAddress)} onClick={() => this.removeFromRestake(validatorAddress)}>Disable REStake</Dropdown.Item>
                          : <Dropdown.Item disabled={!this.canAddToRestake(validatorAddress)} onClick={() => this.addToRestake(validatorAddress)}>Enable REStake</Dropdown.Item>
                      )}
                      {this.restakeEnabled() && <hr />}
                      <ClaimRewards
                        restake={true}
                        network={this.props.network}
                        address={this.props.address}
                        validators={[validatorAddress]}
                        rewards={this.totalRewards([validatorAddress])}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={(loading) => this.setValidatorLoading(validatorAddress, loading)}
                        setError={this.setError} />
                      <ClaimRewards
                        network={this.props.network}
                        address={this.props.address}
                        validators={[validatorAddress]}
                        rewards={this.totalRewards([validatorAddress])}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={(loading) => this.setValidatorLoading(validatorAddress, loading)}
                        setError={this.setError} />
                      <hr />
                      <Delegate
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards} />
                      <Dropdown.Item disabled={true} title="Coming soon" onClick={() => this.redelegate(validatorAddress)}>Redelegate</Dropdown.Item>
                      <Dropdown.Item disabled={true} title="Coming soon" onClick={() => this.undelegate(validatorAddress)}>Undelegate</Dropdown.Item>
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
    }else{
      return null
    }
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

    const alerts = (
      <>
        {this.state.authzMissing &&
        <AlertMessage variant="warning">
          {this.props.network.prettyName} doesn't support authz just yet. You can manually restake for now and REStake is ready when support is enabled
        </AlertMessage>
        }
        {!this.state.authzMissing && !this.props.operator &&
          <AlertMessage variant="warning" message="There are no REStake operators for this network yet. You can REStake manually, or check the About section to run one yourself" />
        }
        {!this.state.authzMissing && this.props.operator && this.state.isNanoLedger &&
        <AlertMessage variant="warning" message="Ledger devices are unable to send authz transactions right now. We will support them as soon as possible, and you can manually restake for now." />
        }
        {this.state.restake.length > 0 && !this.restakeIncludes(this.props.operator.address) &&
          <AlertMessage variant="warning">
            You must include {this.props.operator.moniker} in your REStake selection
          </AlertMessage>
        }
        {this.restakeChanged() &&
          <AlertMessage variant="primary" message="Your validator selection has changed, make sure to update your authz grants using the button below." />
        }
        <AlertMessage message={this.state.error} />
      </>
    )

    if (Object.values(this.props.delegations).length < 1){
      return (
        <>
          {alerts}
          <div className="text-center">
            <p>You have no delegations yet. Stake to a validator first to setup REStake.</p>
            <AddValidator
              network={this.props.network}
              operator={this.props.operator}
              address={this.props.address}
              validators={this.props.validators}
              validatorImages={this.props.validatorImages}
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
        {alerts}
        {Object.values(this.props.delegations).length && (
          <Table className="align-middle table-hover">
            <thead>
              <tr>
                <th colSpan={2}>Validator</th>
                <th>Commission</th>
                <th>APY</th>
                <th>Delegation</th>
                <th>Rewards</th>
                {this.restakeEnabled() &&
                <th>REStake ({this.state.restake.length}/{this.props.operator.data.maxValidators})</th>
                }
                <th></th>
              </tr>
            </thead>
            <tbody>
              {this.props.operator && this.props.operatorDelegation && (
                this.renderDelegation(this.props.operator.address, this.props.operatorDelegation)
              )}
              {this.props.delegations && (
                Object.entries(this.otherDelegations()).map(([validatorAddress, item], i) => {
                  return this.renderDelegation(validatorAddress, item)
                })
              )}
            </tbody>
          </Table>
        )}
        <div className="row">
          <div className="col">
            <AddValidator
              network={this.props.network}
              operator={this.props.operator}
              address={this.props.address}
              validators={this.props.validators}
              validatorImages={this.props.validatorImages}
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
                          network={this.props.network}
                          address={this.props.address}
                          validators={this.state.restake}
                          rewards={this.totalRewards(this.state.restake)}
                          stargateClient={this.props.stargateClient}
                          onClaimRewards={this.onClaimRewards}
                          setLoading={this.setClaimLoading}
                          setError={this.setError} />
                        <ClaimRewards
                          network={this.props.network}
                          address={this.props.address}
                          validators={Object.keys(this.props.delegations)}
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
                  botAddress={this.props.operator.botAddress}
                  stargateClient={this.props.stargateClient}
                  onRevoke={this.onRevoke}
                  setError={this.setError} />
              )}
              {this.restakeChanged() && (
                <UpdateRestake
                  address={this.props.address}
                  botAddress={this.props.operator.botAddress}
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
