import React from "react";
import _ from "lodash";
import { Bech32 } from '@cosmjs/encoding'
import AlertMessage from "./AlertMessage";
import Coins from "./Coins";
import ClaimRewards from "./ClaimRewards";
import RevokeRestake from "./RevokeRestake";
import GrantRestake from "./GrantRestake";
import CountdownRestake from "./CountdownRestake";
import Delegate from "./Delegate";
import ValidatorImage from "./ValidatorImage";
import TooltipIcon from "./TooltipIcon";

import { Table, Button, Dropdown, Spinner } from "react-bootstrap";

import { CheckCircle, XCircle } from "react-bootstrap-icons";

class Delegations extends React.Component {
  constructor(props) {
    super(props);
    this.state = { operatorGrants: {}, validatorLoading: {}, validatorImages: {}, validatorApy: {} };

    this.getValidatorImage = this.getValidatorImage.bind(this);
    this.loadValidatorImages = this.loadValidatorImages.bind(this);
    this.setError = this.setError.bind(this);
    this.setClaimLoading = this.setClaimLoading.bind(this);
    this.onClaimRewards = this.onClaimRewards.bind(this);
    this.onGrant = this.onGrant.bind(this);
    this.onRevoke = this.onRevoke.bind(this);
  }

  async componentDidMount() {
    const isNanoLedger = this.props.stargateClient.getIsNanoLedger();
    this.setState({ isNanoLedger: isNanoLedger });
    this.refresh();
    this.testAndGetGrants()
  }

  async componentDidUpdate(prevProps) {
    if (this.props.network !== prevProps.network) {
      clearInterval(this.state.refreshInterval);
    }

    if (!this.props.address) return;

    if (this.props.address !== prevProps.address) {
      clearInterval(this.state.refreshInterval);
      const isNanoLedger = this.props.stargateClient.getIsNanoLedger();
      this.setState({
        isNanoLedger: isNanoLedger,
        authzMissing: false,
        error: null,
        validatorApy: {},
        operatorGrants: {}
      });
      return this.refresh();
    }

    if (!this.props.delegations) return;
    const matchingDelegations = _.difference(Object.keys(this.props.delegations), prevProps.delegations ? Object.keys(prevProps.delegations) : []).length === 0
    if (!matchingDelegations){
      this.testAndGetGrants()
    }
  }

  componentWillUnmount() {
    clearInterval(this.state.refreshInterval);
  }

  async refresh() {
    this.getRewards();
    this.calculateApy();
    if(this.props.operators){
      this.loadValidatorImages(this.props.network, _.compact(this.props.operators.map(el => el.validatorData)))
      this.loadValidatorImages(this.props.network, _.omit(this.props.validators, this.props.operators.map(el => el.address)))
    }else{
      this.loadValidatorImages(this.props.network, this.props.validators)
    }
    this.refreshInterval();
  }

  refreshInterval() {
    const interval = setInterval(() => {
      this.props.getBalance();
      this.getRewards(true);
    }, 15_000);
    this.setState({ refreshInterval: interval });
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
    if(this.props.network.apyEnabled === false) return

    this.props.network.getApy(
      this.props.validators,
      this.props.operators
    ).then(validatorApy => {
      this.setState({ validatorApy });
    }, error => {
      this.setState({ error: "Failed to get APY. Please refresh" });
    })
  }

  async testAndGetGrants() {
    await this.getTestGrant();
    if (!this.state.authzMissing && this.props.operators.length) {
      this.getGrants();
    }
  }

  async getGrants() {
    if(!this.props.delegations) return;

    const ordered = [...this.props.operators].sort(el => {
      return this.props.delegations[el.address] ? -1 : 0
    })
    const calls = ordered.map((operator) => {
      return () => {
        const { botAddress, address } = operator;
        return this.props.queryClient.getGrants(botAddress, this.props.address).then(
          (result) => {
            let grantValidators;
            if (result.stakeGrant) {
              grantValidators =
                result.stakeGrant.authorization.allow_list.address;
            }
            const operatorGrant = {
              claimGrant: result.claimGrant,
              stakeGrant: result.stakeGrant,
              validators: grantValidators || [],
              grantsValid: !!(
                result.claimGrant &&
                result.stakeGrant &&
                grantValidators.includes(address)
              ),
              grantsExist: !!(result.claimGrant || result.stakeGrant),
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
            if (error.response && error.response.status === 501) {
              this.setState({ authzMissing: true });
            } else {
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

  getTestGrant() {
    return this.props.queryClient
      .getGrants()
      .then(
        (result) => {},
        (error) => {
          if (error.response && error.response.status === 501) {
            this.setState({ authzMissing: true });
          }
        }
      );
  }

  getValidatorImage(network, validatorAddress, expireCache){
    const images = this.state.validatorImages[network.name] || {}
    if(images[validatorAddress]){
      return images[validatorAddress]
    }
    return this.getValidatorImageCache(validatorAddress, expireCache)
  }

  getValidatorImageCache(validatorAddress, expireCache){
    const cache = localStorage.getItem(validatorAddress)
    if(!cache) return

    let cacheData = {}
    try {
      cacheData = JSON.parse(cache)
    } catch {
      cacheData.url = cache
    }
    if(!cacheData.url) return
    if(!expireCache) return cacheData.url

    const cacheTime = cacheData.time && new Date(cacheData.time)
    if(!cacheData.time) return

    const expiry = new Date() - 1000 * 60 * 60 * 24 * 3
    if(cacheTime >= expiry) return cacheData.url
  }

  async loadValidatorImages(network, validators) {
    this.setState((state, props) => ({
      validatorImages: _.set(state.validatorImages, network.name, state.validatorImages[network.name] || {})
    }));
    const calls = Object.values(validators).map(validator => {
      return () => {
        if(validator.description.identity && !this.getValidatorImage(network, validator.operator_address, true)){
          return fetch("https://keybase.io/_/api/1.0/user/lookup.json?fields=pictures&key_suffix=" + validator.description.identity)
            .then((response) => {
              return response.json();
            }).then((data) => {
              if(data.them && data.them[0] && data.them[0].pictures){
                const imageUrl = data.them[0].pictures.primary.url
                this.setState((state, props) => ({
                  validatorImages: _.set(state.validatorImages, [network.name, validator.operator_address], imageUrl)
                }));
                localStorage.setItem(validator.operator_address, JSON.stringify({url: imageUrl, time: +new Date()}))
              }
            }, error => { })
        }else{
          return null
        }
      }
    })
    const batchCalls = _.chunk(calls, 1);

    for (const batchCall of batchCalls) {
      await Promise.allSettled(batchCall.map(call => call()))
    }
  }

  onGrant(operator) {
    const operatorGrant = {
      grantsValid: true,
      grantsExist: true,
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
    setTimeout(() => this.getGrants(), 10_000);
  }

  onRevoke(operator) {
    const operatorGrant = {
      claimGrant: null,
      stakeGrant: null,
      validators: [],
      grantsValid: false,
      grantsExist: false,
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
  }

  onClaimRewards() {
    this.setState({ claimLoading: false, validatorLoading: {}, error: null });
    setTimeout(() => {
      this.props.getBalance();
      this.props.getDelegations();
      this.getRewards();
    }, 6_000);
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

  grantsValid(operator) {
    const grants = this.state.operatorGrants[operator.botAddress];
    return grants && grants.grantsValid;
  }

  restakePossible() {
    return !this.state.isNanoLedger && !this.state.authzMissing;
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
    return _.sortBy(this.props.operators, ({ address }) =>
      this.props.delegations[address] ? 0 : 1
    );
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
    if(!this.props.address || !validator || !window.atob) return false;

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

  validatorRewards(validators) {
    if (!this.state.rewards) return [];

    const denom = this.props.network.denom;
    const validatorRewards = Object.keys(this.state.rewards)
        .map(validator => {
          const validatorReward = this.state.rewards[validator];
          const reward = validatorReward.reward.find((el) => el.denom === denom)
          return {
            validatorAddress: validator,
            reward: reward ? parseInt(reward.amount) : undefined,
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

  renderValidator(validatorAddress, delegation) {
    const validator = this.props.validators[validatorAddress];
    const isValidatorOperator = this.isValidatorOperator(validator)
    if (validator) {
      const rewards =
        this.state.rewards && this.state.rewards[validatorAddress];
      const denomRewards = rewards && this.denomRewards(rewards);
      const operator = this.operatorForValidator(validatorAddress);
      let rowVariant =
        operator && delegation
          ? this.grantsValid(operator)
            ? "table-success"
            : "table-warning"
          : undefined;

      if(isValidatorOperator) rowVariant = 'table-info'

      const delegationBalance = (delegation && delegation.balance) || {
        amount: 0,
        denom: this.props.network.denom,
      };

      const minimumReward = operator && {
        amount: operator.data.minimumReward,
        denom: this.props.network.denom,
      };

      return (
        <tr key={validatorAddress} className={rowVariant}>
          <td width={30}>
            <ValidatorImage
              validator={validator}
              imageUrl={this.getValidatorImage(
                this.props.network,
                validatorAddress
              )}
              width={30}
              height={30}
            />
          </td>
          <td>
            <Delegate
              network={this.props.network}
              address={this.props.address}
              validator={validator}
              validatorApy={this.state.validatorApy}
              operators={this.props.operators}
              getValidatorImage={this.getValidatorImage}
              availableBalance={this.props.balance}
              stargateClient={this.props.stargateClient}
              onDelegate={this.onClaimRewards}
            >
              {validator.description.moniker}
            </Delegate>
          </td>
          <td className="text-center">
            {operator ? (
              this.restakePossible() && delegation ? (
                this.grantsValid(operator) ? (
                  <CountdownRestake
                    network={this.props.network}
                    operator={operator}
                  />
                ) : (
                  <GrantRestake
                    size="sm"
                    variant="success"
                    tooltip="Authorize validator to REStake for you"
                    address={this.props.address}
                    operator={operator}
                    stargateClient={this.props.stargateClient}
                    onGrant={this.onGrant}
                    setError={this.setError}
                  />
                )
              ) : (
                <TooltipIcon
                  icon={<CheckCircle className="text-success" />}
                  identifier={validatorAddress}
                  tooltip="This validator can REStake your rewards"
                />
              )
            ) : (
              <TooltipIcon
                icon={<XCircle className="opacity-50" />}
                identifier={validatorAddress}
                tooltip="This validator is not a REStake operator"
              />
            )}
          </td>
          <td className="d-none d-lg-table-cell text-center">
            {operator && (
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
                    />
                  </p>
                </div>
              </TooltipIcon>
            )}
          </td>
          {this.props.network.apyEnabled !== false && (
            <td className="d-none d-lg-table-cell text-center">
              {Object.keys(this.state.validatorApy).length > 0 
                ? this.state.validatorApy[validatorAddress]
                  ? <small>{Math.round(this.state.validatorApy[validatorAddress] * 100) + "%"}</small>
                  : ""
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
          <td className="d-none d-sm-table-cell">
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
                        this.restakePossible() &&
                        this.grantsValid(operator) && (
                          <>
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
                      <Delegate
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        validatorApy={this.state.validatorApy}
                        operators={this.props.operators}
                        availableBalance={this.props.balance}
                        getValidatorImage={this.getValidatorImage}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards}
                      />
                      <Delegate
                        redelegate={true}
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        validators={this.props.validators}
                        validatorApy={this.state.validatorApy}
                        operators={this.props.operators}
                        availableBalance={
                          (this.props.delegations[validatorAddress] || {})
                            .balance
                        }
                        getValidatorImage={this.getValidatorImage}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards}
                      />
                      <Delegate
                        undelegate={true}
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        validatorApy={this.state.validatorApy}
                        operators={this.props.operators}
                        availableBalance={
                          (this.props.delegations[validatorAddress] || {})
                            .balance
                        }
                        getValidatorImage={this.getValidatorImage}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards}
                      />
                    </Dropdown.Menu>
                  </Dropdown>
                ) : (
                  <Delegate
                    button={true}
                    variant="primary"
                    size="sm"
                    tooltip="Delegate to enable REStake"
                    network={this.props.network}
                    address={this.props.address}
                    validator={validator}
                    validatorApy={this.state.validatorApy}
                    operators={this.props.operators}
                    availableBalance={this.props.balance}
                    getValidatorImage={this.getValidatorImage}
                    stargateClient={this.props.stargateClient}
                    onDelegate={this.onClaimRewards}
                  />
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
        {this.state.authzMissing && (
          <AlertMessage variant="warning" dismissible={false}>
            {this.props.network.prettyName} doesn't support Authz just yet. You
            can manually restake for now and REStake is ready when support is
            enabled
          </AlertMessage>
        )}
        {!this.state.authzMissing && !this.props.operators.length && (
          <AlertMessage
            variant="warning"
            message="There are no REStake operators for this network yet. You can compound manually, or check the About section to run one yourself"
            dismissible={false}
          />
        )}
        {!this.state.authzMissing &&
          this.props.operators.length > 0 &&
          this.state.isNanoLedger && (
            <AlertMessage
              variant="warning"
              message="Ledger devices are unable to send authz transactions right now. We will support them as soon as possible, and you can manually restake for now."
              dismissible={false}
            />
          )}
        <AlertMessage message={this.state.error} />
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
            <Delegate
              button={true}
              variant="primary"
              network={this.props.network}
              address={this.props.address}
              delegations={this.props.delegations}
              operators={this.props.operators}
              validators={this.props.validators}
              validatorApy={this.state.validatorApy}
              getValidatorImage={this.getValidatorImage}
              availableBalance={this.props.balance}
              stargateClient={this.props.stargateClient}
              onDelegate={this.props.onAddValidator}
            />
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
            <Delegate
              button={true}
              network={this.props.network}
              operators={this.props.operators}
              address={this.props.address}
              validators={this.props.validators}
              validatorApy={this.state.validatorApy}
              getValidatorImage={this.getValidatorImage}
              delegations={this.props.delegations}
              availableBalance={this.props.balance}
              stargateClient={this.props.stargateClient}
              onDelegate={this.props.onAddValidator}
            />
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
      </>
    );
  }
}

export default Delegations;
