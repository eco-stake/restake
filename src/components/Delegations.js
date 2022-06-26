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
    this.state = { operatorGrants: {}, validatorLoading: {}, validatorApy: {}, validatorModal: {} };

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
    const isNanoLedger = this.props.stargateClient?.getIsNanoLedger();
    this.setState({ isNanoLedger: isNanoLedger });
    await this.getDelegations()
    this.getGrants(true)
    this.refresh();

    if (this.props.validator) {
      this.showValidatorModal(this.props.validator)
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    if (prevProps.validator !== this.props.validator && this.props.validator && !this.state.validatorModal.show) {
      this.showValidatorModal(this.props.validator)
    }

    if ((this.props.network !== prevProps.network && !this.props.address)
      || (this.props.address !== prevProps.address)) {
      this.clearRefreshInterval()
      const isNanoLedger = this.props.stargateClient?.getIsNanoLedger();
      this.setState({
        isNanoLedger: isNanoLedger,
        delegations: undefined, 
        validatorApy: {},
        operatorGrants: {},
        error: null,
      });
      await this.getDelegations()
      this.refresh();
      if(this.state.delegations){
        return this.getGrants(true)
      }
    }

    if (this.state.delegations && prevState.delegations){
      const delegationsChanged = _.difference(Object.keys(this.state.delegations), Object.keys(prevState.delegations || {})).length > 0
      if (delegationsChanged) {
        this.getGrants(true)
      }
    }
  }

  componentWillUnmount() {
    this.clearRefreshInterval()
  }

  async refresh() {
    this.calculateApy();
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
    const grantInterval = setInterval(() => {
      this.getGrants(true);
    }, 60_000);
    this.setState({ refreshInterval, delegateInterval, grantInterval });
  }

  clearRefreshInterval(){
    clearInterval(this.state.refreshInterval);
    clearInterval(this.state.delegateInterval);
    clearInterval(this.state.grantInterval);
  }

  async getDelegations(hideError) {
    if(!this.props.address) return

    return this.props.queryClient.getDelegations(this.props.address)
      .then(
        (delegations) => {
          const orderedAddresses = Object.keys(this.props.validators)
          delegations = orderedAddresses.reduce((sum, address) => {
            if(delegations[address] && delegations[address].balance.amount !== '0'){
              sum[address] = delegations[address]
            }
            return sum
          }, {})
          this.setState({
            delegations: delegations,
          });
        },
        (error) => {
          if([404, 500].includes(error.response && error.response.status)){
            this.setState({
              delegations: {},
            });
          }else if(!hideError){
            this.setState({
              error: 'Failed to load delegations. API may be down.',
            });
          }
        }
      )
  }

  async getWithdrawAddress() {
    if(!this.props.address) return

    const withdraw = await this.props.queryClient.getWithdrawAddress(this.props.address)
    if (withdraw !== this.props.address) {
      this.setState({ error: 'You have a different withdraw address set. REStake WILL NOT WORK!' })
    }
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
              this.setState({ error: "Failed to get rewards. Please refresh" });
          }
        }
      );
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
      this.setState({ error: "Failed to get APY. Please refresh" });
    })
  }

  async getGrants(hideError) {
    if (!this.props.address || !this.authzSupport() || !this.props.operators.length) return

    let allGrants
    try {
      allGrants = await this.props.queryClient.getGranterGrants(this.props.address)
      this.setAllGrants(allGrants, this.props.operators, this.props.address)
      return
    } catch (e) { console.log('Failed to get all grants in batch') }

    const calls = this.orderedOperators().map((operator) => {
      return () => {
        const { botAddress } = operator;
        if (!this.props.address || !this.props.operators.includes(operator)) return;

        return this.props.queryClient.getGrants(botAddress, this.props.address).then(
          (result) => {
            this.setGrants(result, botAddress, this.props.address)
          },
          (error) => {
            if (!hideError) {
              this.setState({ error: "Failed to get grants. Please refresh" });
            }
          }
        );
      }
    });

    const batchCalls = _.chunk(calls, 5);

    for (const batchCall of batchCalls) {
      await Promise.allSettled(batchCall.map(call => call()))
    }
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

  setAllGrants(grants, operators, granter){
    const operatorGrants = operators.reduce((sum, operator) => {
      const grantee = operator.botAddress
      sum[grantee] = this.buildGrants(grants, grantee, granter)
      return sum
    }, {})
    this.setState({operatorGrants: operatorGrants})
  }

  setGrants(grants, grantee, granter){
    const operatorGrant = this.buildGrants(grants, grantee, granter)
    this.setState((state, props) => ({
      operatorGrants: _.set(
        state.operatorGrants,
        grantee,
        operatorGrant
      ),
    }));
  }

  onGrant(operator, expired, maxTokens) {
    this.clearRefreshInterval()
    const operatorGrant = expired ? this.defaultGrant : {
      stakeGrant: {},
      validators: [operator.address],
      maxTokens: maxTokens ? bignumber(maxTokens.amount) : null
    };
    this.setState((state, props) => ({
      operatorGrants: _.set(
        state.operatorGrants,
        operator.botAddress,
        operatorGrant
      ),
      error: null,
      validatorLoading: _.set(state.validatorLoading, operator.address, false),
    }));
    this.refreshInterval()
  }

  onRevoke(operator) {
    this.clearRefreshInterval()
    this.setState((state, props) => ({
      operatorGrants: _.set(
        state.operatorGrants,
        operator.botAddress,
        this.defaultGrant
      ),
      error: null,
      validatorLoading: _.set(state.validatorLoading, operator.address, false),
    }));
    this.refreshInterval()
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

  orderedOperators() {
    const { delegations, operators } = this.props
    if(!delegations) return operators
    return _.sortBy(operators, ({ address }) => delegations[address] ? -1 : 0)
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
    return this.props.address && !this.state.isNanoLedger && this.authzSupport();
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
        validator={validatorModal.validator}
        activeTab={validatorModal.activeTab}
        redelegate={validatorModal.redelegate}
        undelegate={validatorModal.undelegate}
        network={this.props.network}
        address={this.props.address}
        validators={this.props.validators}
        validatorApy={this.state.validatorApy}
        operators={this.props.operators}
        balance={this.props.balance}
        rewards={this.state.rewards}
        delegations={this.state.delegations || {}}
        grants={this.operatorGrants()}
        authzSupport={this.authzSupport()}
        restakePossible={this.restakePossible()}
        stargateClient={this.props.stargateClient}
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
          this.state.isNanoLedger && (
            <>
              <AlertMessage
                variant="warning"
                dismissible={false}
              >
                <p>Ledger devices are not supported in the REStake UI currently. Support will be added as soon as it is possible.</p>
                <p className="mb-0"><span onClick={() => this.setState({ showAboutLedger: true })} role="button" className="text-reset text-decoration-underline">A manual workaround is possible using the CLI</span></p>
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
            network={this.props.network}
            address={this.props.address}
            validators={this.props.validators}
            operators={this.props.operators}
            validatorApy={this.state.validatorApy}
            delegations={this.state.delegations || {}}
            rewards={this.state.rewards}
            stargateClient={this.props.stargateClient}
            validatorLoading={this.state.validatorLoading}
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
                        validatorRewards={this.validatorRewards()}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={this.setClaimLoading}
                        setError={this.setError}
                      />
                      <ClaimRewards
                        restake={true}
                        network={this.props.network}
                        address={this.props.address}
                        validatorRewards={this.validatorRewards()}
                        stargateClient={this.props.stargateClient}
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
