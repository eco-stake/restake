import React from "react";
import _ from "lodash";
import { larger, bignumber } from 'mathjs'
import { Bech32 } from '@cosmjs/encoding'
import AlertMessage from "./AlertMessage";
import Coins from "./Coins";
import ClaimRewards from "./ClaimRewards";
import RevokeRestake from "./RevokeRestake";
import ValidatorModal from "./ValidatorModal";
import ValidatorImage from "./ValidatorImage";
import TooltipIcon from "./TooltipIcon";
import AboutLedger from "./AboutLedger";

import { Table, Button, Dropdown, Spinner, OverlayTrigger, Tooltip } from "react-bootstrap";

import ValidatorName from "./ValidatorName";
import ManageRestake from "./ManageRestake";

class Delegations extends React.Component {
  constructor(props) {
    super(props);
    this.state = { operatorGrants: {}, validatorLoading: {}, validatorApy: {}, validatorModal: {} };

    this.setError = this.setError.bind(this);
    this.setClaimLoading = this.setClaimLoading.bind(this);
    this.onClaimRewards = this.onClaimRewards.bind(this);
    this.onGrant = this.onGrant.bind(this);
    this.onRevoke = this.onRevoke.bind(this);
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
    const isNanoLedger = this.props.stargateClient.getIsNanoLedger();
    this.setState({ isNanoLedger: isNanoLedger });
    this.getGrants()
    this.refresh();

    if (this.props.validator) {
      this.showValidatorModal(this.props.validator.operator_address)
    }
  }

  async componentDidUpdate(prevProps) {
    if (this.props.network !== prevProps.network) {
      clearInterval(this.state.refreshInterval);
      clearInterval(this.state.grantInterval);
    }

    if (!this.props.address) return;

    if (this.props.address !== prevProps.address) {
      clearInterval(this.state.refreshInterval);
      clearInterval(this.state.grantInterval);
      const isNanoLedger = this.props.stargateClient.getIsNanoLedger();
      this.setState({
        isNanoLedger: isNanoLedger,
        error: null,
        validatorApy: {},
        operatorGrants: {}
      });
      this.refresh();
      if(this.props.delegations){
        return this.getGrants()
      }
    }

    if (!this.props.delegations) return

    const delegationsChanged = _.difference(Object.keys(this.props.delegations), Object.keys(prevProps.delegations || {})).length > 0
    if (delegationsChanged) {
      this.getGrants()
    }

    if (prevProps.validator !== this.props.validator && this.props.validator && !this.state.validatorModal.show) {
      this.showValidatorModal(this.props.validator.operator_address)
    }
  }

  componentWillUnmount() {
    clearInterval(this.state.refreshInterval);
    clearInterval(this.state.grantInterval);
  }

  async refresh() {
    this.getWithdrawAddress();
    this.getRewards();
    this.calculateApy();
    this.refreshInterval();
  }

  refreshInterval() {
    const refreshInterval = setInterval(() => {
      this.props.getBalance();
      this.getRewards(true);
    }, 15_000);
    const grantInterval = setInterval(() => {
      this.getGrants(true);
    }, 60_000);
    this.setState({ refreshInterval, grantInterval });
  }

  async getWithdrawAddress() {
    const withdraw = await this.props.queryClient.getWithdrawAddress(this.props.address)
    if (withdraw !== this.props.address) {
      this.setState({ error: 'You have a different withdraw address set. REStake WILL NOT WORK!' })
    }
  }

  getRewards(hideError) {
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
    if (this.props.network.apyEnabled === false || !this.props.network.getApy) return

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
    if (!this.authzSupport() || !this.props.operators.length) return

    const calls = this.orderedOperators().map((operator) => {
      return () => {
        const { botAddress, address } = operator;
        if (!this.props.operators.includes(operator)) return;

        return this.props.queryClient.getGrants(botAddress, this.props.address).then(
          (result) => {
            const { claimGrant, stakeGrant } = result
            let grantValidators, maxTokens;
            if (stakeGrant) {
              grantValidators =
                stakeGrant.authorization.allow_list?.address;
              maxTokens = stakeGrant.authorization.max_tokens
            }
            const operatorGrant = {
              claimGrant: claimGrant,
              stakeGrant: stakeGrant,
              validators: grantValidators,
              maxTokens: maxTokens ? bignumber(maxTokens.amount) : null
            };
            this.setState((state, props) => ({
              operatorGrants: _.set(
                state.operatorGrants,
                botAddress,
                operatorGrant
              ),
            }));
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

  onGrant(operator, expired, maxTokens) {
    clearInterval(this.state.refreshInterval);
    clearInterval(this.state.grantInterval);
    const operatorGrant = expired ? this.defaultGrant : {
      claimGrant: {},
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
    clearInterval(this.state.refreshInterval);
    clearInterval(this.state.grantInterval);
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
      this.props.getDelegations();
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
          grant.claimGrant &&
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
    return !this.state.isNanoLedger && this.authzSupport();
  }

  operatorForValidator(validatorAddress) {
    return this.props.operators.find((el) => el.address === validatorAddress);
  }

  operatorAddresses() {
    return this.props.operators.map((operator) => operator.address);
  }

  operatorBotAddresses() {
    return this.props.operators.map((operator) => operator.botAddress);
  }

  orderedOperators() {
    return _.sortBy(this.props.operators, ({ address }) => {
      if (!this.props.delegations) return 0

      return this.props.delegations[address] ? 0 : 1
    });
  }

  regularDelegations() {
    return Object.values(
      _.omit(this.props.delegations, this.operatorAddresses())
    );
  }

  noDelegations() {
    return (
      Object.values(this.props.operators).length < 1 &&
      Object.values(this.props.delegations).length < 1
    );
  }

  isValidatorOperator(validator) {
    if (!this.props.address || !validator || !window.atob) return false;

    const prefix = this.props.network.prefix
    const validatorOperator = Bech32.encode(prefix, Bech32.decode(validator.operator_address).data)
    return validatorOperator === this.props.address
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

  denomRewards(rewards) {
    return rewards.reward.find(
      (reward) => reward.denom === this.props.network.denom
    );
  }

  showValidatorModal(address, opts) {
    opts = opts || {}
    const validator = address && this.props.validators[address]
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
        delegations={this.props.delegations}
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

  renderValidator(validatorAddress, delegation) {
    const validator = this.props.validators[validatorAddress];
    const isValidatorOperator = this.isValidatorOperator(validator)
    if (validator) {
      const rewards =
        this.state.rewards && this.state.rewards[validatorAddress];
      const denomRewards = rewards && this.denomRewards(rewards);
      const operator = this.operatorForValidator(validatorAddress);
      const grants = operator && this.operatorGrants()[operator.botAddress]
      let rowVariant =
        operator && delegation
          ? grants.grantsValid
            ? "table-success"
            : grants.grantsExist ? "table-danger" : "table-warning"
          : undefined;

      if (isValidatorOperator) rowVariant = 'table-info'

      const delegationBalance = (delegation && delegation.balance) || {
        amount: 0,
        denom: this.props.network.denom,
      };

      const minimumReward = operator && {
        amount: operator.minimumReward,
        denom: this.props.network.denom,
      };

      return (
        <tr key={validatorAddress} className={rowVariant}>
          <td>{validator.rank || '-'}</td>
          <td width={30}>
            <ValidatorImage
              validator={validator}
              width={30}
              height={30}
            />
          </td>
          <td>
            <span role="button" onClick={() => this.showValidatorModal(validatorAddress, { activeTab: 'profile' })}>
              <ValidatorName validator={validator} />
            </span>
          </td>
          <td className="text-center">
            <ManageRestake
              size="sm"
              network={this.props.network}
              validator={validator}
              operator={operator}
              grants={operator && this.operatorGrants()[operator.botAddress]}
              delegation={delegation}
              authzSupport={this.authzSupport()}
              restakePossible={this.restakePossible()}
              openGrants={() => this.showValidatorModal(validatorAddress, { activeTab: 'restake' })}
            />
          </td>
          <td className="d-none d-lg-table-cell text-center">
            {operator && (
              <span role="button" onClick={() => this.showValidatorModal(validatorAddress, { activeTab: 'restake' })}>
                <TooltipIcon
                  icon={<small className="text-decoration-underline">{operator.frequency()}</small>}
                  identifier={operator.address}
                >
                  <div className="mt-2 text-center">
                    <p>REStakes {operator.runTimesString()}</p>
                    <p>
                      Minimum reward is{" "}
                      <Coins
                        coins={minimumReward}
                        decimals={this.props.network.decimals}
                        fullPrecision={true}
                      />
                    </p>
                  </div>
                </TooltipIcon>
              </span>
            )}
          </td>
          {this.props.network.apyEnabled !== false && (
            <td className="d-none d-lg-table-cell text-center">
              {Object.keys(this.state.validatorApy).length > 0
                ? this.state.validatorApy[validatorAddress]
                  ? <small>{Math.round(this.state.validatorApy[validatorAddress] * 100) + "%"}</small>
                  : "-"
                : (
                  <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                )}
            </td>
          )}
          <td className="d-none d-sm-table-cell">
            <small>
              <Coins
                coins={delegationBalance}
                decimals={this.props.network.decimals}
              />
            </small>
          </td>
          <td className="d-none d-md-table-cell">
            {denomRewards && (
              <small>
                <Coins
                  key={denomRewards.denom}
                  coins={denomRewards}
                  decimals={this.props.network.decimals}
                />
              </small>
            )}
          </td>
          <td>
            <div className="d-grid gap-2 d-md-flex justify-content-end">
              {!this.state.validatorLoading[validatorAddress] ? (
                delegation ? (
                  <Dropdown>
                    <Dropdown.Toggle
                      variant="secondary"
                      size="sm"
                      id="dropdown-basic"
                    >
                      Manage
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {operator &&
                        this.restakePossible() && (
                          <>
                            <Dropdown.Item onClick={() => this.showValidatorModal(validatorAddress, { activeTab: 'restake' })}>
                              {this.operatorGrants()[operator.botAddress].grantsValid ? 'Manage REStake' : 'Enable REStake'}
                            </Dropdown.Item>
                            {this.operatorGrants()[operator.botAddress].grantsExist && (
                              <RevokeRestake
                                address={this.props.address}
                                operator={operator}
                                stargateClient={this.props.stargateClient}
                                onRevoke={this.onRevoke}
                                setLoading={(loading) =>
                                  this.setValidatorLoading(
                                    validatorAddress,
                                    loading
                                  )
                                }
                                setError={this.setError}
                              />
                            )}
                            <hr />
                          </>
                        )}
                      <ClaimRewards
                        network={this.props.network}
                        address={this.props.address}
                        validatorRewards={this.validatorRewards([validatorAddress])}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={(loading) =>
                          this.setValidatorLoading(validatorAddress, loading)
                        }
                        setError={this.setError}
                      />
                      <ClaimRewards
                        restake={true}
                        network={this.props.network}
                        address={this.props.address}
                        validatorRewards={this.validatorRewards([validatorAddress])}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={(loading) =>
                          this.setValidatorLoading(validatorAddress, loading)
                        }
                        setError={this.setError}
                      />
                      {isValidatorOperator && (
                        <>
                          <hr />
                          <ClaimRewards
                            commission={true}
                            network={this.props.network}
                            address={this.props.address}
                            validatorRewards={this.validatorRewards([validatorAddress])}
                            stargateClient={this.props.stargateClient}
                            onClaimRewards={this.onClaimRewards}
                            setLoading={(loading) =>
                              this.setValidatorLoading(validatorAddress, loading)
                            }
                            setError={this.setError}
                          />
                        </>
                      )}
                      <hr />
                      <Dropdown.Item onClick={() => this.showValidatorModal(validatorAddress, { activeTab: 'delegate' })}>
                        Delegate
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => this.showValidatorModal(validatorAddress, { redelegate: true })}>
                        Redelegate
                      </Dropdown.Item>
                      <Dropdown.Item onClick={() => this.showValidatorModal(validatorAddress, { undelegate: true })}>
                        Undelegate
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown>
                ) : (
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip id={`tooltip-${validatorAddress}`}>
                        Delegate to enable REStake
                      </Tooltip>
                    }
                  >
                    <Button variant="primary" size="sm" onClick={() => this.showValidatorModal(validatorAddress, { activeTab: 'delegate' })}>
                      Delegate
                    </Button>
                  </OverlayTrigger>
                )
              ) : (
                <Button className="btn-sm btn-secondary mr-5" disabled>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  &nbsp;
                </Button>
              )}
            </div>
          </td>
        </tr>
      );
    } else {
      return null;
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
      );
    }

    const alerts = (
      <>
        {!this.authzSupport() && (
          <AlertMessage variant="warning" dismissible={false}>
            {this.props.network.prettyName} doesn't support Authz just yet. You
            can manually restake for now and REStake is ready when support is
            enabled
          </AlertMessage>
        )}
        {this.authzSupport() && !this.props.operators.length && (
          <AlertMessage
            variant="warning"
            message="There are no REStake operators for this network yet. You can compound manually, or check the About section to run one yourself"
            dismissible={false}
          />
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
                <p className="mb-0"><span onClick={() => this.setState({ showAboutLedger: true })} role="button" className="text-dark text-decoration-underline">A manual workaround is possible using the CLI</span></p>
              </AlertMessage>
            </>
          )}
        <AlertMessage message={this.state.error} />
        {this.props.network && (
          <AboutLedger show={this.state.showAboutLedger} onHide={() => this.setState({ showAboutLedger: false })} network={this.props.network} />
        )}
      </>
    );

    if (this.noDelegations()) {
      return (
        <>
          {alerts}
          <div className="text-center">
            <p>
              There are no REStake operators for this network yet. You can
              delegate to other validators in the meantime.
            </p>
            <Button variant="primary" onClick={() => this.showValidatorModal()}>
              Add Validator
            </Button>
            {this.renderValidatorModal()}
          </div>
        </>
      );
    }

    return (
      <>
        {alerts}
        {!this.noDelegations() && (
          <Table className="align-middle table-striped">
            <thead>
              <tr>
                <th>#</th>
                <th colSpan={2}>Validator</th>
                <th className="d-none d-sm-table-cell text-center">REStake</th>
                <th className="d-none d-lg-table-cell text-center">
                  Frequency
                </th>
                {this.props.network.apyEnabled !== false && (
                  <th className="d-none d-lg-table-cell text-center">
                    <TooltipIcon
                      icon={<span className="text-decoration-underline">APY</span>}
                      identifier="delegations-apy"
                    >
                      <div className="mt-2 text-center">
                        <p>Based on commission, compounding frequency and estimated block times.</p>
                        <p>This is a best case scenario and may not be 100% accurate.</p>
                      </div>
                    </TooltipIcon>
                  </th>
                )}
                <th className="d-none d-sm-table-cell">Delegation</th>
                <th className="d-none d-sm-table-cell">Rewards</th>
                <th width={110}></th>
              </tr>
            </thead>
            <tbody>
              {this.orderedOperators().length > 0 &&
                this.orderedOperators().map((operator) => {
                  const delegation =
                    this.props.delegations &&
                    this.props.delegations[operator.address];
                  return this.renderValidator(operator.address, delegation);
                })}
              {this.regularDelegations().length > 0 &&
                this.regularDelegations().map((delegation) => {
                  return this.renderValidator(
                    delegation.delegation.validator_address,
                    delegation
                  );
                })}
            </tbody>
          </Table>
        )}
        <div className="row">
          <div className="col">
            <Button variant="secondary" onClick={() => this.showValidatorModal()}>
              Add Validator
            </Button>
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
