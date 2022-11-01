import React, { useState, useEffect } from 'react';
import { larger, smaller, round } from 'mathjs'
import moment from 'moment'

import {
  Table,
  Dropdown,
  Button,
  Spinner
} from 'react-bootstrap'
import { ChevronLeft, CheckCircle, XCircle, QuestionCircle } from "react-bootstrap-icons";

import Coins from './Coins';
import TooltipIcon from './TooltipIcon'

import DelegateForm from './DelegateForm'
import { rewardAmount } from '../utils/Helpers.mjs';
import ClaimRewards from './ClaimRewards';
import Validators from './Validators'
import AlertMessage from './AlertMessage'
import REStakeGrantForm from './REStakeGrantForm';
import Address from './Address';
import OperatorLastRestake from './OperatorLastRestake';
import CountdownRestake from './CountdownRestake';
import RevokeGrant from './RevokeGrant';
import ValidatorStatus from './ValidatorStatus'

function ValidatorStake(props) {
  const { network, validator, operator, balance, wallet, address, lastExec } = props
  const [action, setAction] = useState(props.action)
  const [selectedValidator, setSelectedValidator] = useState();
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState()

  const delegation = props.delegations && props.delegations[validator.address]
  const validatorRewards = props.rewards && props.rewards[validator.address]
  const reward = rewardAmount(validatorRewards, network.denom)
  const validatorCommission = props.commission && props.commission[validator.address]
  const commission = rewardAmount(validatorCommission, network.denom, 'commission')
  const validatorGrants = props.grants && operator && props.grants[operator.botAddress]
  const { grantsValid, grantsExist, maxTokens, stakeGrant } = validatorGrants || {}

  useEffect(() => {
    setAction(props.action)
  }, [props.action])

  useEffect(() => {
    setError()
    props.onChangeAction && props.onChangeAction(action)
  }, [action])

  function actionText() {
    if (action === 'redelegate') {
      if (selectedValidator) {
        return `Redelegate to ${selectedValidator.moniker}`
      }
      return 'Redelegate to...'
    }
    if (action === 'undelegate') return `Undelegate from ${validator.moniker}`
    if (action === 'grant') return `${grantsValid ? 'Manage' : 'Enable'} ${validator.moniker} REStake`
    return `Delegate to  ${validator.moniker}`
  }

  function onDelegate() {
    setAction()
    props.onDelegate()
  }

  function onGrant(grantee, grant) {
    setAction()
    props.onGrant(grantee, grant)
  }

  function onRevoke(grantee, msgTypes) {
    setAction()
    props.onRevoke(grantee, msgTypes)
  }

  const minimumReward = () => {
    return {
      amount: operator.minimumReward,
      denom: network.denom
    }
  }

  function expiryDate() {
    const stakeExpiry = stakeGrant && stakeGrant.expiration && moment(stakeGrant.expiration)
    return stakeExpiry
  }

  return (
    <>
      {error &&
        <AlertMessage variant="danger" dismissible={true}>
          {error}
        </AlertMessage>
      }
      {action ? (
        <>
          <div className="d-flex align-items-center my-3">
            {action && (
              <ChevronLeft className="me-1" role="button" onClick={() => {
                action === 'redelegate' && selectedValidator ? setSelectedValidator() : setAction()
              }} />
            )}
            <h5 className="m-0">{actionText()}</h5>
          </div>
          {action === 'redelegate' && !selectedValidator ? (
            <>
              <Validators
                modal={true}
                network={network}
                address={props.address}
                wallet={props.wallet}
                validators={props.validators}
                operators={props.operators}
                exclude={[validator.operator_address]}
                validatorApy={props.validatorApy}
                rewards={props.rewards}
                delegations={props.delegations}
                operatorGrants={props.grants}
                authzSupport={props.authzSupport}
                restakePossible={props.restakePossible}
                showValidator={setSelectedValidator}
                isLoading={props.isLoading}
                buttonText="Redelegate" />
              <div className="d-flex justify-content-end gap-2">
                <Button variant="secondary" onClick={() => setAction()}>Cancel</Button>
              </div>
            </>
          ) : action === 'grant' ? (
            <REStakeGrantForm
              network={network}
              address={props.address}
              wallet={props.wallet}
              operator={operator}
              lastExec={lastExec}
              grants={validatorGrants}
              delegation={delegation}
              rewards={validatorRewards}
              validatorApy={props.validatorApy}
              authzSupport={props.authzSupport}
              restakePossible={props.restakePossible}
              signingClient={props.signingClient}
              closeForm={() => setAction()}
              onGrant={onGrant}
              onRevoke={onRevoke}
            />
          ) : (
            <DelegateForm
              action={action}
              network={network}
              validator={validator}
              selectedValidator={selectedValidator}
              address={address}
              wallet={wallet}
              balance={balance}
              delegation={delegation}
              signingClient={props.signingClient}
              closeForm={() => setAction()}
              onDelegate={onDelegate} />
          )}
        </>
      ) : (
        <>
          <div className="row">
            <div className="col-12 col-lg-6 small mb-3">
              <Table>
                <tbody>
                  {!validator.active && (
                    <tr>
                      <td scope="row">Status</td>
                      <td><ValidatorStatus validator={validator} /></td>
                    </tr>
                  )}
                  {network.apyEnabled && (
                    <>
                      <tr>
                        <td scope="row">
                          APR
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <span>{round(validator.getAPR() * 100, 2).toLocaleString()}%</span>
                            <TooltipIcon
                              icon={<QuestionCircle className="ms-2" />}
                              identifier="delegations-apr"
                            >
                              <div className="mt-2 text-center">
                                <p>{round(network.chain.estimatedApr * 100, 2).toLocaleString()}% staking APR<br />- {validator.commissionRate * 100}% commission</p>
                                <p>Staking APR is calculated based on recent block time and is not guaranteed.</p>
                              </div>
                            </TooltipIcon>
                          </div>
                        </td>
                      </tr>
                      {operator && (
                        <tr>
                          <td scope="row">
                            APY
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <span>{round(validator.getAPY(operator) * 100, 2).toLocaleString()}%</span>
                              <TooltipIcon
                                icon={<QuestionCircle className="ms-2" />}
                                identifier="delegations-apy"
                              >
                                <div className="mt-2 text-center">
                                  <p>{round(validator.getAPR() * 100, 2).toLocaleString()}% APR compounded {operator.frequency(true)} by {validator.moniker}.</p>
                                  <p>This is an estimate and best case scenario.</p>
                                </div>
                              </TooltipIcon>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                  {address && (
                    <tr>
                      <td scope="row">Delegation</td>
                      <td className="text-break">
                        {!props.isLoading('delegations') ? (
                          <Coins coins={delegation?.balance || { amount: 0, denom: network.denom }} asset={network.baseAsset} fullPrecision={true} />
                        ) : (
                          <Spinner animation="border" role="status" className="spinner-border-sm">
                            <span className="visually-hidden">Loading...</span>
                          </Spinner>
                        )}
                      </td>
                    </tr>
                  )}
                  {delegation?.balance?.amount && (
                    <tr>
                      <td scope="row">Rewards</td>
                      <td>
                        {!props.isLoading('rewards') ? (
                          <Coins coins={{ amount: reward, denom: network.denom }} asset={network.baseAsset} fullPrecision={true} />
                        ) : (
                          <Spinner animation="border" role="status" className="spinner-border-sm">
                            <span className="visually-hidden">Loading...</span>
                          </Spinner>
                        )}
                      </td>
                    </tr>
                  )}
                  {!!commission && (
                    <tr>
                      <td scope="row">Commission</td>
                      <td>
                        {!props.isLoading('commission') ? (
                          <Coins coins={{ amount: commission, denom: network.denom }} asset={network.baseAsset} fullPrecision={true} />
                        ) : (
                          <Spinner animation="border" role="status" className="spinner-border-sm">
                            <span className="visually-hidden">Loading...</span>
                          </Spinner>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
            <div className="col-12 col-lg-6 small mb-3">
              <Table>
                <tbody>
                  <tr>
                    <td scope="row">REStake</td>
                    <td>
                      {operator ? (
                        <TooltipIcon
                          icon={<CheckCircle className="text-success" />}
                          identifier={validator.operator_address}
                          tooltip="This validator can REStake your rewards"
                        />
                      ) : (
                        <TooltipIcon
                          icon={<XCircle className="opacity-50" />}
                          identifier={validator.operator_address}
                          tooltip="This validator is not a REStake operator"
                        />
                      )}
                    </td>
                  </tr>
                  {operator && (
                    <>
                      <tr>
                        <td scope="row">Frequency</td>
                        <td>
                          <span>{operator.runTimesString()}</span>
                        </td>
                      </tr>
                      <tr>
                        <td scope="row">Minimum Reward</td>
                        <td>
                          <Coins coins={minimumReward()} asset={network.baseAsset} fullPrecision={true} hideValue={true} />
                        </td>
                      </tr>
                      {network.authzSupport && (
                        <>
                          <tr>
                            <td scope="row">Last REStake</td>
                            <td>
                              <OperatorLastRestake operator={operator} lastExec={lastExec} />
                            </td>
                          </tr>
                          <tr>
                            <td scope="row">Next REStake</td>
                            <td>
                              <CountdownRestake
                                network={network}
                                operator={operator}
                              />
                            </td>
                          </tr>
                        </>
                      )}
                      <tr>
                        <td scope="row">REStake Address</td>
                        <td className="text-break"><Address address={operator.botAddress} /></td>
                      </tr>
                      {props.address && (
                        <>
                          <tr>
                            <td scope="row">Grant Status</td>
                            <td>
                              {!props.isLoading('grants') ? (
                                grantsValid
                                  ? <span><span className="text-success">Active</span><br /><small className="text-muted">expires {expiryDate().fromNow()}</small></span>
                                  : grantsExist
                                    ? maxTokens && smaller(maxTokens, reward)
                                      ? <span className="text-danger">Not enough grant remaining</span>
                                      : <span className="text-danger">Invalid / total delegation reached</span>
                                    : network.authzSupport ? <em>Inactive</em> : <em>Authz not supported</em>
                              ) : (
                                <Spinner animation="border" role="status" className="spinner-border-sm">
                                  <span className="visually-hidden">Loading...</span>
                                </Spinner>
                              )}
                            </td>
                          </tr>
                          {grantsExist && (
                            <tr>
                              <td scope="row">Grant Remaining</td>
                              <td className={!reward || maxTokens == null || larger(maxTokens, reward) ? 'text-success' : 'text-danger'}>
                                {maxTokens ? (
                                  <Coins coins={{ amount: maxTokens, denom: network.denom }} asset={network.baseAsset} fullPrecision={true} />
                                ) : (
                                  'Unlimited'
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </>
                  )}
                </tbody>
              </Table>
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2">
            {delegation?.balance?.amount && wallet && (
              !loading ? (
                <Dropdown>
                  <Dropdown.Toggle
                    variant="secondary"
                  >
                    Manage
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <ClaimRewards
                      network={network}
                      address={address}
                      wallet={wallet}
                      rewards={validatorRewards && [validatorRewards]}
                      signingClient={props.signingClient}
                      onClaimRewards={props.onClaimRewards}
                      setLoading={(loading) =>
                        setLoading(loading)
                      }
                      setError={setError}
                    />
                    <ClaimRewards
                      restake={true}
                      network={network}
                      address={address}
                      wallet={wallet}
                      rewards={validatorRewards && [validatorRewards]}
                      signingClient={props.signingClient}
                      onClaimRewards={props.onClaimRewards}
                      setLoading={(loading) =>
                        setLoading(loading)
                      }
                      setError={setError}
                    />
                    {!!commission && (
                      <ClaimRewards
                        commission={true}
                        network={network}
                        address={address}
                        wallet={wallet}
                        rewards={validatorRewards && [validatorRewards]}
                        signingClient={props.signingClient}
                        onClaimRewards={props.onClaimRewards}
                        setLoading={(loading) =>
                          setLoading(loading)
                        }
                        setError={setError}
                      />
                    )}
                    <hr />
                    <Dropdown.Item as="button" disabled={!wallet?.hasPermission(address, 'BeginRedelegate')} onClick={() => {
                      setSelectedValidator()
                      setAction('redelegate')
                    }}>
                      Redelegate
                    </Dropdown.Item>
                    <Dropdown.Item as="button" disabled={!wallet?.hasPermission(address, 'Undelegate')} onClick={() => setAction('undelegate')}>
                      Undelegate
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <Button className="btn-sm btn-secondary" disabled>
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  &nbsp;
                </Button>
              )
            )}
            <TooltipIcon
              icon={
                <div>
                  <Button variant="primary" disabled={!wallet?.hasPermission(address, 'Delegate')} onClick={() => setAction('delegate')}>
                    Delegate
                  </Button>
                </div>
              }
              identifier={validator.operator_address}
              tooltip={
                !wallet ? `Connect a wallet to delegate`
                  : !wallet?.hasPermission(address, 'Delegate') && `You don't have permission to do that.`
              }
            />
            {operator && grantsValid ? (
              <Dropdown>
                <Dropdown.Toggle
                  variant="success"
                  disabled={!props.restakePossible}
                >
                  REStake
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item as="button" disabled={(!wallet?.hasPermission(address, 'Grant') && !wallet?.hasPermission(address, 'Revoke'))} onClick={() => {
                    setAction('grant')
                  }}>
                    Manage Grant
                  </Dropdown.Item>
                  <RevokeGrant
                    address={props.address}
                    wallet={props.wallet}
                    grantAddress={operator.botAddress}
                    grants={[validatorGrants.stakeGrant, validatorGrants.claimGrant]}
                    buttonText="Disable REStake"
                    signingClient={props.signingClient}
                    onRevoke={onRevoke}
                    setLoading={(loading) =>
                      setLoading(loading)
                    }
                    setError={setError} />
                </Dropdown.Menu>
              </Dropdown>
            ) : operator && (
              <TooltipIcon
                icon={
                  <div>
                    <Button variant="success" disabled={!props.restakePossible || !delegation?.balance?.amount || !wallet?.hasPermission(address, 'Grant')} onClick={() => setAction('grant')}>
                      Enable REStake
                    </Button>
                  </div>
                }
                identifier={validator.operator_address}
                tooltip={
                  !network.authzSupport ? `${props.network.prettyName} doesn't support Authz just yet`
                    : !wallet ? `Connect a wallet to enable REStake`
                      : !wallet.authzSupport() ? `${wallet.getIsNanoLedger() ? 'Ledger devices' : 'This wallet'} can't send Authz transactions on ${network.prettyName} yet`
                        : !delegation?.balance?.amount ? `You must delegate to ${validator.moniker} before they can REStake for you.`
                          : !wallet?.hasPermission(address, 'Grant') && `You don't have permission to do that.`
                }
              />
            )}
          </div>
        </>
      )}
    </>
  )
}

export default ValidatorStake