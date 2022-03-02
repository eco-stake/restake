import React from 'react'
import _ from 'lodash'
import AlertMessage from './AlertMessage'
import Coins from './Coins'
import ClaimRewards from './ClaimRewards'
import RevokeRestake from './RevokeRestake'
import GrantRestake from './GrantRestake'
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
    this.state = {operatorGrants: {}, validatorLoading: {}}

    this.setError = this.setError.bind(this)
    this.setClaimLoading = this.setClaimLoading.bind(this)
    this.onClaimRewards = this.onClaimRewards.bind(this)
    this.onGrant = this.onGrant.bind(this)
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
    }
  }

  refresh(){
    this.getRewards()
    if(this.props.operators.length){
      this.getGrants()
    }else{
      this.getTestGrant()
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
    if(this.state.authzMissing) return
    this.props.operators.forEach(operator => {
      const {botAddress, address} = operator
      this.props.restClient.getGrants(botAddress, this.props.address)
        .then(
          (result) => {
            let grantValidators
            if(result.stakeGrant){
              grantValidators = result.stakeGrant.authorization.allow_list.address
            }
            const operatorGrant = {
              claimGrant: result.claimGrant,
              stakeGrant: result.stakeGrant,
              validators: grantValidators || [],
              grantsValid: !!(result.claimGrant && result.stakeGrant && grantValidators.includes(address)),
              grantsExist: !!(result.claimGrant || result.stakeGrant),
            }
            this.setState((state, props) => ({
              operatorGrants: _.set(state.operatorGrants, botAddress, operatorGrant)
            }))
          }, (error) => {
            if (error.response.status === 501) {
              this.setState({ authzMissing: true });
            }else{
              this.setState({ error });
            }
          })
    })
  }

  getTestGrant(){
    this.props.restClient.getGrants(this.props.network.data.testaddress, this.props.address)
      .then(
        (result) => { }, (error) => {
          if (error.response.status === 501) {
            this.setState({ authzMissing: true });
          }
        })
  }

  onGrant(operator){
    const operatorGrant = {
      grantsValid: true,
      grantsExist: true
    }
    this.setState((state, props) => ({
      operatorGrants: _.set(state.operatorGrants, operator.botAddress, operatorGrant),
      error: null,
      validatorLoading: _.set(state.validatorLoading, operator.address, false)
    }))
    setTimeout(() => this.getGrants(), 10_000)
  }

  onRevoke(operator) {
    const operatorGrant = {
      claimGrant: null,
      stakeGrant: null,
      validators: [],
      grantsValid: false,
      grantsExist: false
    }
    this.setState((state, props) => ({
      operatorGrants: _.set(state.operatorGrants, operator.botAddress, operatorGrant),
      error: null,
      validatorLoading: _.set(state.validatorLoading, operator.address, false)
    }))
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
    this.setState((state, props) => ({
      validatorLoading: _.set(state.validatorLoading, validatorAddress, value)
    }))
  }

  setError(error){
    this.setState({ error: error })
  }

  grantsValid(operator){
    const grants = this.state.operatorGrants[operator.botAddress]
    return grants && grants.grantsValid
  }

  restakePossible(){
    return !this.state.isNanoLedger && !this.state.authzMissing
  }

  operatorForValidator(validatorAddress){
    return this.props.operators.find(el => el.address === validatorAddress)
  }

  operatorAddresses(){
    return this.props.operators.map(operator => operator.address)
  }

  operatorBotAddresses(){
    return this.props.operators.map(operator => operator.botAddress)
  }

  operatorDelegations(){
    return _.pick(this.props.delegations, this.operatorAddresses());
  }

  otherDelegations(){
    return _.omit(this.props.delegations, this.operatorAddresses())
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

  renderDelegation(validatorAddress, item){
    const validator = this.props.validators[validatorAddress]
    if(validator){
      const rewards = this.state.rewards && this.state.rewards[validatorAddress]
      const operator = this.operatorForValidator(validatorAddress)
      let rowVariant = operator ? 'table-warning' : undefined

      return (
        <tr key={validatorAddress} className={rowVariant}>
          <td width={30}><ValidatorImage validator={validator} imageUrl={this.props.getValidatorImage(this.props.network, validatorAddress)} width={30} height={30} /></td>
          <td>
            <Delegate
              network={this.props.network}
              address={this.props.address}
              validator={validator}
              getValidatorImage={this.props.getValidatorImage}
              availableBalance={this.props.balance}
              stargateClient={this.props.stargateClient}
              onDelegate={this.onClaimRewards}>{validator.description.moniker}</Delegate>
          </td>
          <td className="d-none d-sm-table-cell text-center">{operator ? <CheckCircle className="text-success" /> : <XCircle className="opacity-50" />}</td>
          <td className="d-none d-lg-table-cell">{validator.commission.commission_rates.rate * 100}%</td>
          <td className="d-none d-lg-table-cell"></td>
          <td className="d-none d-sm-table-cell"><Coins coins={item.balance} /></td>
          <td className="d-none d-sm-table-cell">{rewards && rewards.reward.map(el => <Coins key={el.denom} coins={el} />)}</td>
          {this.restakePossible() && (
            <td>
              {operator && (
                this.grantsValid(operator) ? (
                  <RevokeRestake
                    size="sm" variant="outline-danger"
                    address={this.props.address}
                    operator={operator}
                    stargateClient={this.props.stargateClient}
                    onRevoke={this.onRevoke}
                    setError={this.setError} />
                ) : (
                  <GrantRestake
                    size="sm" variant="outline-success"
                    address={this.props.address}
                    operator={operator}
                    stargateClient={this.props.stargateClient}
                    onGrant={this.onGrant}
                    setError={this.setError} />
                )
              )}
            </td>
          )}
          <td>
            <div className="d-grid gap-2 d-md-flex justify-content-end">
              {!this.state.validatorLoading[validatorAddress]
                ? (
                  <Dropdown>
                    <Dropdown.Toggle variant="secondary" size="sm" id="dropdown-basic">
                      Manage
                    </Dropdown.Toggle>

                    <Dropdown.Menu>
                      <ClaimRewards
                        network={this.props.network}
                        address={this.props.address}
                        validators={[validatorAddress]}
                        rewards={this.totalRewards([validatorAddress])}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={(loading) => this.setValidatorLoading(validatorAddress, loading)}
                        setError={this.setError} />
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
                      <hr />
                      <Delegate
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        availableBalance={this.props.balance}
                        getValidatorImage={this.props.getValidatorImage}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards} />
                      <Delegate
                        redelegate={true}
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        validators={this.props.validators}
                        operators={this.props.operators}
                        availableBalance={(this.props.delegations[validatorAddress] || {}).balance}
                        getValidatorImage={this.props.getValidatorImage}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards} />
                      <Delegate
                        undelegate={true}
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        operators={this.props.operators}
                        availableBalance={(this.props.delegations[validatorAddress] || {}).balance}
                        getValidatorImage={this.props.getValidatorImage}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards} />
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
        <AlertMessage variant="warning" dismissible={false}>
          {this.props.network.prettyName} doesn't support Authz just yet. You can manually restake for now and REStake is ready when support is enabled
        </AlertMessage>
        }
        {!this.state.authzMissing && !this.props.operators.length &&
          <AlertMessage variant="warning" message="There are no REStake operators for this network yet. You can compound manually, or check the About section to run one yourself" dismissible={false} />
        }
        {!this.state.authzMissing && this.props.operators.length > 0 && this.state.isNanoLedger &&
          <AlertMessage variant="warning" message="Ledger devices are unable to send authz transactions right now. We will support them as soon as possible, and you can manually restake for now." dismissible={false} />
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
            <Delegate
              button={true}
              variant="primary"
              network={this.props.network}
              address={this.props.address}
              delegations={this.props.delegations}
              operators={this.props.operators}
              validators={this.props.validators}
              getValidatorImage={this.props.getValidatorImage}
              availableBalance={this.props.balance}
              stargateClient={this.props.stargateClient}
              onDelegate={this.props.onAddValidator} />
          </div>
        </>
      )
    }

    return (
      <>
        {alerts}
        {Object.values(this.props.delegations).length > 0 && (
          <Table className="align-middle table-hover">
            <thead>
              <tr>
                <th colSpan={2}>Validator</th>
                <th className="d-none d-sm-table-cell text-center">Operator</th>
                <th className="d-none d-lg-table-cell">Commission</th>
                <th className="d-none d-lg-table-cell">APY</th>
                <th className="d-none d-sm-table-cell">Delegation</th>
                <th className="d-none d-sm-table-cell">Rewards</th>
                {this.restakePossible() &&
                <th>REStake</th>
                }
                <th width={110}></th>
              </tr>
            </thead>
            <tbody>
              {this.props.operators.length > 0 && (
                Object.entries(this.operatorDelegations()).map(([validatorAddress, item], i) => {
                  return this.renderDelegation(validatorAddress, item)
                })
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
            <Delegate
              button={true}
              network={this.props.network}
              operators={this.props.operators}
              address={this.props.address}
              validators={this.props.validators}
              getValidatorImage={this.props.getValidatorImage}
              delegations={this.props.delegations}
              availableBalance={this.props.balance}
              stargateClient={this.props.stargateClient}
              onDelegate={this.props.onAddValidator} />
          </div>
          <div className="col">
            <div className="d-grid gap-2 d-md-flex justify-content-md-end">
              {this.state.rewards && this.totalRewards().amount > 0 && (
                !this.state.claimLoading
                  ? (
                    <Dropdown>
                      <Dropdown.Toggle variant="secondary" id="claim-dropdown">
                        All Rewards
                      </Dropdown.Toggle>

                      <Dropdown.Menu>
                        <ClaimRewards
                          network={this.props.network}
                          address={this.props.address}
                          validators={Object.keys(this.props.delegations)}
                          rewards={this.totalRewards()}
                          stargateClient={this.props.stargateClient}
                          onClaimRewards={this.onClaimRewards}
                          setLoading={this.setClaimLoading}
                          setError={this.setError} />
                        <ClaimRewards
                          restake={true}
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
            </div>
          </div>
        </div>
      </>
    )
  }
}

export default Delegations;
