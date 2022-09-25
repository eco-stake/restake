import React from "react";
import _ from "lodash";
import { larger, bignumber } from 'mathjs'
import AlertMessage from "./AlertMessage";
import ClaimRewards from "./ClaimRewards";
import ValidatorModal from "./ValidatorModal";
import AboutLedger from "./AboutLedger";

import { Button, Dropdown, Spinner } from "react-bootstrap";

import { parseGrants } from "../utils/Helpers.mjs";
import Validators from "./Validators";

class Delegations extends React.Component {
  constructor(props) {
    super(props);
    this.state = { operatorGrants: {}, validatorLoading: {}, validatorApy: {}, validatorModal: {}, commission: {} };

    this.setError = this.setError.bind(this);
    this.setClaimLoading = this.setClaimLoading.bind(this);
    this.onClaimRewards = this.onClaimRewards.bind(this);
    this.onGrant = this.onGrant.bind(this);
    this.onRevoke = this.onRevoke.bind(this);
    this.validatorRewards = this.validatorRewards.bind(this);
    this.showValidatorModal = this.showValidatorModal.bind(this);
    this.setValidatorLoading = this.setValidatorLoading.bind(this);
    this.hideValidatorModal = this.hideValidatorModal.bind(this);
    this.defaultGrant = {
      claimGrant: null,
      stakeGrant: null,
      validators: [],
      grantsValid: false,
      grantsExist: false,
    }
  }

  async componentDidMount() {
    const walletAuthzSupport = this.props.wallet?.authzSupport();
    this.setState({ walletAuthzSupport });
    this.refresh(true);

    if (this.props.validator) {
      this.showValidatorModal(this.props.validator)
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    if (this.state.validatorModal.validator !== this.props.validator && this.props.validator) {
      this.showValidatorModal(this.props.validator)
    }

    if ((this.props.network !== prevProps.network && !this.props.address)
      || (this.props.address !== prevProps.address)) {
      this.clearRefreshInterval()
      const walletAuthzSupport = this.props.wallet?.authzSupport();
      this.setState({
        walletAuthzSupport: walletAuthzSupport,
        delegations: undefined, 
        rewards: undefined,
        commission: {},
        validatorApy: {},
        operatorGrants: {},
        error: null,
      });
      this.refresh(false);
    }

    if (this.props.grants !== prevProps.grants){
      this.getGrants()
    }
  }

  componentWillUnmount() {
    this.clearRefreshInterval()
  }

  async refresh(getGrants) {
    this.calculateApy();
    await this.getDelegations()
    if (getGrants){
      this.getGrants()
    }
    this.getWithdrawAddress();
    this.getRewards();
    this.refreshInterval();
  }

  refreshInterval() {
    const refreshInterval = setInterval(() => {
      this.props.getBalance();
      this.getRewards(true);
    }, 15_000);
    const delegateInterval = setInterval(() => {
      this.getDelegations(true)
    }, 30_000)
    this.setState({ refreshInterval, delegateInterval });
  }

  clearRefreshInterval(){
    clearInterval(this.state.refreshInterval);
    clearInterval(this.state.delegateInterval);
  }

  async getDelegations(hideError) {
    if(!this.props.address) return
    const address = this.props.address

    return this.props.queryClient.getDelegations(address)
      .then(
        (delegations) => {
          const orderedAddresses = Object.keys(this.props.validators)
          delegations = orderedAddresses.reduce((sum, address) => {
            if(delegations[address] && delegations[address].balance.amount !== '0'){
              sum[address] = delegations[address]
            }
            return sum
          }, {})
          if(address === this.props.address){
            this.setState({
              delegations: delegations,
            });
          }
        },
        (error) => {
          if(address !== this.props.address) return

          if([404, 500].includes(error.response && error.response.status)){
            this.setState({
              delegations: {},
            });
          }else if(!hideError){
            this.setState({
              error: 'Failed to load delegations.',
            });
          }
        }
      )
  }

  async getWithdrawAddress() {
    if(!this.props.address) return
    const address = this.props.address

    return this.props.queryClient.getWithdrawAddress(address).then(withdraw => {
      if (withdraw !== address) {
        this.setState({ error: 'You have a different withdraw address set. REStake WILL NOT WORK!' })
      }
    }, error => {
      console.log('Failed to get withdraw address', error)
    })
  }

  getRewards(hideError) {
    if(!this.props.address) return

    this.props.queryClient
      .getRewards(this.props.address, this.props.network.denom)
      .then(
        (rewards) => {
          this.setState({ rewards: rewards });
        },
        (error) => {
          if ([404, 500].includes(error.response && error.response.status)) {
            this.setState({ rewards: {} });
          } else {
            if (!hideError)
              this.setState({ error: "Failed to get rewards." });
          }
        }
      );

    Object.values(this.props.validators).forEach(validator => {
      if(validator.isValidatorOperator(this.props.address)){
        this.props.queryClient.getCommission(validator.address).then((commission) => {
          this.setState((state, props) => ({
            commission: _.set(
              state.commission,
              validator.address,
              commission
            ),
          }));
        })
      }
    })
  }

  async calculateApy() {
    if (!this.props.network.apyEnabled || !this.props.network.getApy) return

    this.props.network.getApy(
      this.props.validators,
      this.props.operators
    ).then(validatorApy => {
      this.setState({ validatorApy });
    }, error => {
      console.log(error)
      this.setState({ error: "Failed to get APY." });
    })
  }

  async getGrants() {
    if (!this.props.grants?.granter) return

    const operatorGrants = this.props.operators.reduce((sum, operator) => {
      const grantee = operator.botAddress
      sum[grantee] = this.buildGrants(this.props.grants.granter, grantee, this.props.address)
      return sum
    }, {})
    this.setState({operatorGrants: operatorGrants})
  }

  buildGrants(grants, grantee, granter){
    const { claimGrant, stakeGrant } = parseGrants(grants, grantee, granter)
    let grantValidators, maxTokens;
    if (stakeGrant) {
      grantValidators =
        stakeGrant.authorization.allow_list?.address;
      maxTokens = stakeGrant.authorization.max_tokens
    }
    return {
      claimGrant: claimGrant,
      stakeGrant: stakeGrant,
      validators: grantValidators,
      maxTokens: maxTokens ? bignumber(maxTokens.amount) : null
    };
  }

  onGrant(grantAddress, grant) {
    const operator = this.props.operators.find(el => el.botAddress === grantAddress)
    if(operator){
      this.setState((state, props) => ({
        error: null,
        validatorLoading: _.set(state.validatorLoading, operator.address, false),
      }));
    }
    this.props.onGrant(grantAddress, grant)
  }

  onRevoke(grantAddress, msgTypes) {
    const operator = this.props.operators.find(el => el.botAddress === grantAddress)
    if(operator){
      this.setState((state, props) => ({
        error: null,
        validatorLoading: _.set(state.validatorLoading, operator.address, false),
      }));
    }else{
      this.setState({ error: null });
    }
    this.props.onRevoke(grantAddress, msgTypes)
  }

  onClaimRewards() {
    this.setState({ claimLoading: false, validatorLoading: {}, error: null });
    setTimeout(() => {
      this.props.getBalance();
      this.getDelegations();
      this.getRewards();
    }, 3_000);
  }

  setClaimLoading(value) {
    if (value) this.setState({ error: null });
    this.setState({ claimLoading: !!value });
  }

  setValidatorLoading(validatorAddress, value) {
    if (value) this.setState({ error: null });
    this.setState((state, props) => ({
      validatorLoading: _.set(state.validatorLoading, validatorAddress, value),
    }));
  }

  setError(error) {
    this.setState({ error: error });
  }

  authzSupport() {
    return this.props.network.authzSupport
  }

  operatorGrants() {
    if (!this.state.operatorGrants) return {}
    return this.props.operators.reduce((sum, operator) => {
      let grant = this.state.operatorGrants[operator.botAddress]
      if (!grant) grant = this.defaultGrant;
      sum[operator.botAddress] = {
        ...grant,
        grantsValid: !!(
          grant.stakeGrant &&
          (!grant.validators || grant.validators.includes(operator.address)) &&
          (grant.maxTokens === null || larger(grant.maxTokens, this.validatorReward(operator.address)))
        ),
        grantsExist: !!(grant.claimGrant || grant.stakeGrant),
      }
      return sum
    }, {})
  }

  restakePossible() {
    return this.props.address && this.state.walletAuthzSupport && this.authzSupport();
  }

  totalRewards(validators) {
    if (!this.state.rewards) return;

    const denom = this.props.network.denom;
    const total = Object.values(this.state.rewards).reduce((sum, item) => {
      const reward = item.reward.find((el) => el.denom === denom);
      if (
        reward &&
        (validators === undefined ||
          validators.includes(item.validator_address))
      ) {
        return sum + parseInt(reward.amount);
      }
      return sum;
    }, 0);
    return {
      amount: total,
      denom: denom,
    };
  }

  validatorReward(validatorAddress) {
    if (!this.state.rewards) return 0;
    const denom = this.props.network.denom;
    const validatorReward = this.state.rewards[validatorAddress];
    const reward = validatorReward && validatorReward.reward.find((el) => el.denom === denom)
    return reward ? bignumber(reward.amount) : 0
  }

  validatorRewards(validators) {
    if (!this.state.rewards) return [];

    const validatorRewards = Object.keys(this.state.rewards)
      .map(validator => {
        return {
          validatorAddress: validator,
          reward: this.validatorReward(validator),
        }
      })
      .filter(validatorReward => {
        return validatorReward.reward && (validators === undefined || validators.includes(validatorReward.validatorAddress))
      });

    return validatorRewards;
  }

  showValidatorModal(validator, opts) {
    opts = opts || {}
    this.setState({ validatorModal: { show: true, validator: validator, ...opts } })
  }

  hideValidatorModal(opts) {
    opts = opts || {}
    this.setState((state, props) => {
      return { validatorModal: { ...state.validatorModal, show: false } }
    })
  }

  renderValidatorModal() {
    const validatorModal = this.state.validatorModal

    return (
      <ValidatorModal
        show={validatorModal.show}
        theme={this.props.theme}
        validator={validatorModal.validator}
        activeTab={validatorModal.activeTab}
        redelegate={validatorModal.redelegate}
        undelegate={validatorModal.undelegate}
        network={this.props.network}
        networks={this.props.networks}
        address={this.props.address}
        wallet={this.props.wallet}
        validators={this.props.validators}
        validatorApy={this.state.validatorApy}
        operators={this.props.operators}
        balance={this.props.balance}
        rewards={this.state.rewards}
        commission={this.state.commission}
        delegations={this.state.delegations || {}}
        grants={this.operatorGrants()}
        authzSupport={this.authzSupport()}
        restakePossible={this.restakePossible()}
        signingClient={this.props.signingClient}
        hideModal={this.hideValidatorModal}
        onDelegate={this.onClaimRewards}
        onGrant={this.onGrant}
        onRevoke={this.onRevoke}
        setError={this.setError}
      />
    )
  }

  render() {
    if (!this.props.validators) {
      return (
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      );
    }

    const alerts = (
      <>
        {!this.authzSupport() && (
          <AlertMessage variant="info" dismissible={false}>
            {this.props.network.prettyName} doesn't support Authz just yet. You can stake and compound manually, REStake will update automatically when support is added.
          </AlertMessage>
        )}
        {this.authzSupport() &&
          this.props.operators.length > 0 &&
          this.props.wallet &&
          !this.state.walletAuthzSupport && (
            <>
              <AlertMessage
                variant="warning"
                dismissible={false}
              >
                {this.props.wallet.getIsNanoLedger() ? (
                  <>
                    <p>Ledger devices can't send Authz transactions on {this.props.network.prettyName} just yet. All other features are supported and Authz is coming soon.</p>
                    <p className="mb-0"><span onClick={() => this.setState({ showAboutLedger: true })} role="button" className="text-reset text-decoration-underline">A manual workaround is possible using the CLI.</span></p>
                  </>
                ) : (
                  <>
                    <p className="mb-0">This wallet can't send Authz transactions on {this.props.network.prettyName} just yet. All other features are supported, and Keplr Extension likely has support if required.</p>
                  </>
                )}
              </AlertMessage>
            </>
          )}
        <AlertMessage message={this.state.error} />
        {this.props.network && (
          <AboutLedger show={this.state.showAboutLedger} onHide={() => this.setState({ showAboutLedger: false })} network={this.props.network} />
        )}
      </>
    );

    return (
      <>
        {alerts}
        <div className="mb-2">
          <Validators 
            theme={this.props.theme}
            network={this.props.network}
            address={this.props.address}
            wallet={this.props.wallet}
            validators={this.props.validators}
            operators={this.props.operators}
            validatorApy={this.state.validatorApy}
            delegations={this.state.delegations}
            rewards={this.state.rewards}
            commission={this.state.commission}
            signingClient={this.props.signingClient}
            validatorLoading={this.state.validatorLoading}
            isLoading={this.props.wallet && (!this.state.delegations || (this.props.network?.authzSupport && !this.props.grants?.granter))}
            operatorGrants={this.operatorGrants()}
            authzSupport={this.authzSupport()}
            restakePossible={this.restakePossible()}
            validatorRewards={this.validatorRewards}
            showValidator={this.showValidatorModal}
            setValidatorLoading={this.setValidatorLoading}
            setError={this.setError}
            onClaimRewards={this.onClaimRewards}
            onRevoke={this.onRevoke} />
        </div>
        <div className="row">
          <div className="col">
            {this.props.address && (
              <Button variant="secondary" onClick={() => this.showValidatorModal()}>
                Add Validator
              </Button>
            )}
          </div>
          <div className="col">
            <div className="d-grid gap-2 d-md-flex justify-content-end">
              {this.state.rewards &&
                (!this.state.claimLoading ? (
                  <Dropdown>
                    <Dropdown.Toggle
                      variant="secondary"
                      id="claim-dropdown"
                      disabled={this.totalRewards().amount === 0}
                    >
                      All Rewards
                    </Dropdown.Toggle>

                    <Dropdown.Menu>
                      <ClaimRewards
                        network={this.props.network}
                        address={this.props.address}
                        wallet={this.props.wallet}
                        validatorRewards={this.validatorRewards()}
                        signingClient={this.props.signingClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={this.setClaimLoading}
                        setError={this.setError}
                      />
                      <ClaimRewards
                        restake={true}
                        network={this.props.network}
                        address={this.props.address}
                        wallet={this.props.wallet}
                        validatorRewards={this.validatorRewards()}
                        signingClient={this.props.signingClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={this.setClaimLoading}
                        setError={this.setError}
                      />
                    </Dropdown.Menu>
                  </Dropdown>
                ) : (
                  <Button className="btn-secondary mr-5" disabled>
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    &nbsp;
                  </Button>
                ))}
            </div>
          </div>
        </div>
        {this.renderValidatorModal()}
      </>
    );
  }
}

export default Delegations;
