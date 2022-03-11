import React from "react";
import _ from "lodash";
import AlertMessage from "./AlertMessage";
import Coins from "./Coins";
import ClaimRewards from "./ClaimRewards";
import RevokeRestake from "./RevokeRestake";
import GrantRestake from "./GrantRestake";
import Delegate from "./Delegate";
import ValidatorImage from "./ValidatorImage";
import TooltipIcon from "./TooltipIcon";

import { Table, Button, Dropdown, Spinner } from "react-bootstrap";

import { CheckCircle, XCircle } from "react-bootstrap-icons";
import axios from "axios";

function parseCommissionRate(validator) {
  return (
    parseInt(validator.commission.commissionRates.rate) / 1000000000000000000
  );
}

function duration(epochs, epochIdentifier) {
  const epoch = epochs.find((epoch) => epoch.identifier === epochIdentifier);
  if (!epoch) {
    return 0;
  }

  // Actually, the date type of golang protobuf is returned by the unit of seconds.
  return parseInt(epoch.duration.replace("s", ""));
}

class Delegations extends React.Component {
  constructor(props) {
    super(props);
    this.state = { operatorGrants: {}, validatorLoading: {} };

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
      });
      this.refresh();
    }
  }

  componentWillUnmount() {
    clearInterval(this.state.refreshInterval);
  }

  refresh() {
    this.getRewards();
    this.calculateApy();
    this.refreshInterval();
    if (this.props.operators.length) {
      this.getGrants();
    } else {
      this.getTestGrant();
    }
  }

  refreshInterval() {
    const interval = setInterval(() => {
      this.getRewards(true);
    }, 15_000);
    this.setState({ refreshInterval: interval });
  }

  getRewards(hideError) {
    this.props.restClient
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

  async getOsmosisInflation() {
    const osmosisParams = await axios.get(
      this.props.network.restUrl + "/osmosis/mint/v1beta1/params"
    );
    const osmosisEpoch = await axios.get(
      this.props.network.restUrl + "/osmosis/epochs/v1beta1/epochs"
    );
    const epochProvisions = await axios.get(
      this.props.network.restUrl + "/osmosis/mint/v1beta1/epoch_provisions"
    );
    const pool = await axios.get(
      this.props.network.restUrl + "/cosmos/staking/v1beta1/pool"
    );
    const total = await axios.get(
      this.props.network.restUrl + "/bank/total/" + this.props.network.denom
    );
    let data = {
      params: osmosisParams.data.params,
      epoch: osmosisEpoch.data.epochs,
      provisions: epochProvisions.data.epoch_provisions,
      total: parseInt(total.data.result.amount),
      bonded_tokens: parseInt(pool.data.pool.bonded_tokens),
    };
    const mintingEpochProvision =
      parseFloat(data.params.distribution_proportions.staking) *
      data.provisions;
    const epochDuration = duration(data.epoch, data.params.epoch_identifier);
    const yearMintingProvision =
      (mintingEpochProvision * (365 * 24 * 3600)) / epochDuration;
    const dec = yearMintingProvision / data.total;
    const ratio = data.bonded_tokens / data.total;
    return dec / ratio;
  }

  async getInflation() {
    if (this.props.network.chainId.startsWith("osmosis")) {
      return this.getOsmosisInflation();
    } else if (this.props.network.chainId.startsWith("sifchain")) {
      let inflation = await axios.get(
        "https://data.sifchain.finance/beta/validator/stakingRewards"
      );
      return inflation.data.rate;
    } else {
      return await this.props.restClient.getInflation();
    }
  }

  async calculateApy() {
    if (this.props.network.chainId.startsWith("juno")) {
      const params = await axios.get(
        this.props.network.restUrl + "/cosmos/mint/v1beta1/params"
      );
    }
    const { validators } = this.props;
    const periodPerYear = 365;
    if (this.props.network.chainId.startsWith("osmosis")) {
      const chainApr = await this.getInflation();
      let validatorApy = {};
      for (const [address, validator] of Object.entries(validators)) {
        const realApr = chainApr * (1 - parseCommissionRate(validator));
        const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
        validatorApy[address] = apy;
      }
      this.setState({ validatorApy });
    } else if (this.props.network.chainId.startsWith("sifchain")) {
      const chainApr = await this.getInflation();
      let validatorApy = {};
      for (const [address, validator] of Object.entries(validators)) {
        const realApr = chainApr * (1 - parseCommissionRate(validator));
        const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
        //console.log(chainApr, realApr, apy);
        validatorApy[address] = apy;
      }
      this.setState({ validatorApy });
    } else {
      const total = await axios.get(
        this.props.network.restUrl + "/bank/total/" + this.props.network.denom
      );
      const pool = await axios.get(
        this.props.network.restUrl + "/cosmos/staking/v1beta1/pool"
      );
      const bondedTokens = parseInt(pool.data.pool.bonded_tokens);
      const totalSupply = parseInt(total.data.result.amount);

      const ratio = bondedTokens / totalSupply;
      const inflation = await this.getInflation();
      const chainApr = inflation / ratio;
      let validatorApy = {};
      for (const [address, validator] of Object.entries(validators)) {
        const realApr = chainApr * (1 - parseCommissionRate(validator));
        const apy = (1 + realApr / periodPerYear) ** periodPerYear - 1;
        validatorApy[address] = apy;
      }
      this.setState({ validatorApy });
    }
  }

  getGrants() {
    this.props.operators.forEach((operator) => {
      const { botAddress, address } = operator;
      this.props.restClient.getGrants(botAddress, this.props.address).then(
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
    });
  }

  getTestGrant() {
    this.props.restClient
      .getGrants(this.props.network.data.testAddress, this.props.address)
      .then(
        (result) => {},
        (error) => {
          if (error.response && error.response.status === 501) {
            this.setState({ authzMissing: true });
          }
        }
      );
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
      this.props.getDelegations();
      this.getRewards();
    }, 5_000);
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

  denomRewards(rewards) {
    return rewards.reward.find(
      (reward) => reward.denom === this.props.network.denom
    );
  }

  renderValidator(validatorAddress, delegation) {
    const validator = this.props.validators[validatorAddress];
    if (validator) {
      const rewards =
        this.state.rewards && this.state.rewards[validatorAddress];
      const denomRewards = rewards && this.denomRewards(rewards);
      const operator = this.operatorForValidator(validatorAddress);
      let rowVariant = operator ? "table-warning" : undefined;

      const delegationBalance = (delegation && delegation.balance) || {
        amount: 0,
        denom: this.props.network.denom,
      };

      return (
        <tr key={validatorAddress} className={rowVariant}>
          <td width={30}>
            <ValidatorImage
              validator={validator}
              imageUrl={this.props.getValidatorImage(
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
              getValidatorImage={this.props.getValidatorImage}
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
                  <RevokeRestake
                    size="sm"
                    variant="outline-danger"
                    address={this.props.address}
                    operator={operator}
                    stargateClient={this.props.stargateClient}
                    onRevoke={this.onRevoke}
                    setError={this.setError}
                  />
                ) : (
                  <GrantRestake
                    size="sm"
                    variant="success"
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
                  tooltip="This validator can auto-compound your rewards"
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
          <td className="d-none d-lg-table-cell">
            {parseCommissionRate(validator) * 100}%
          </td>
          <td className="d-none d-lg-table-cell">
            {this.state.validatorApy
              ? !isNaN(this.state.validatorApy[validatorAddress])
                ? (this.state.validatorApy[validatorAddress] * 100)
                    .toFixed(2)
                    .toString() + " %"
                : ""
              : ""}
          </td>
          <td className="d-none d-sm-table-cell">
            <Coins
              coins={delegationBalance}
              decimals={this.props.network.data.decimals}
            />
          </td>
          <td className="d-none d-sm-table-cell">
            {denomRewards && (
              <Coins
                key={denomRewards.denom}
                coins={denomRewards}
                decimals={this.props.network.data.decimals}
              />
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
                      <ClaimRewards
                        network={this.props.network}
                        address={this.props.address}
                        validators={[validatorAddress]}
                        rewards={this.totalRewards([validatorAddress])}
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
                        validators={[validatorAddress]}
                        rewards={this.totalRewards([validatorAddress])}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={(loading) =>
                          this.setValidatorLoading(validatorAddress, loading)
                        }
                        setError={this.setError}
                      />
                      <hr />
                      <Delegate
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        availableBalance={this.props.balance}
                        getValidatorImage={this.props.getValidatorImage}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards}
                      />
                      <Delegate
                        redelegate={true}
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        validators={this.props.validators}
                        operators={this.props.operators}
                        availableBalance={
                          (this.props.delegations[validatorAddress] || {})
                            .balance
                        }
                        getValidatorImage={this.props.getValidatorImage}
                        stargateClient={this.props.stargateClient}
                        onDelegate={this.onClaimRewards}
                      />
                      <Delegate
                        undelegate={true}
                        network={this.props.network}
                        address={this.props.address}
                        validator={validator}
                        operators={this.props.operators}
                        availableBalance={
                          (this.props.delegations[validatorAddress] || {})
                            .balance
                        }
                        getValidatorImage={this.props.getValidatorImage}
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
                    availableBalance={this.props.balance}
                    getValidatorImage={this.props.getValidatorImage}
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
              getValidatorImage={this.props.getValidatorImage}
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
          <Table className="align-middle table-hover">
            <thead>
              <tr>
                <th colSpan={2}>Validator</th>
                <th className="d-none d-sm-table-cell text-center">REStake</th>
                <th className="d-none d-lg-table-cell">Commission</th>
                <th className="d-none d-lg-table-cell">APY</th>
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
              blocksPerYear={this.state.blocksPerYear}
              inflation={this.state.inflation}
              network={this.props.network}
              operators={this.props.operators}
              address={this.props.address}
              validators={this.props.validators}
              getValidatorImage={this.props.getValidatorImage}
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
                        validators={Object.keys(this.props.delegations)}
                        rewards={this.totalRewards()}
                        stargateClient={this.props.stargateClient}
                        onClaimRewards={this.onClaimRewards}
                        setLoading={this.setClaimLoading}
                        setError={this.setError}
                      />
                      <ClaimRewards
                        restake={true}
                        network={this.props.network}
                        address={this.props.address}
                        validators={Object.keys(this.props.delegations)}
                        rewards={this.totalRewards()}
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
