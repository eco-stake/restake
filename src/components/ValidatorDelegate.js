import React, { useState, useEffect } from 'react';
import { round } from 'mathjs'

import {
  Table,
  Spinner,
  Dropdown,
  Button,
} from 'react-bootstrap'
import { ChevronLeft } from "react-bootstrap-icons";

import Coins from './Coins';
import TooltipIcon from './TooltipIcon'

import DelegateForm from './DelegateForm'
import { rewardAmount } from '../utils/Helpers.mjs';
import ClaimRewards from './ClaimRewards';
import Validators from './Validators'
import AlertMessage from './AlertMessage'

function ValidatorDelegate(props) {
  const { network, validator, balance, wallet, address } = props
  const [action, setAction] = useState(props.action)
  const [selectedValidator, setSelectedValidator] = useState();
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState()

  const delegation = props.delegations && props.delegations[validator.address]
  const validatorRewards = props.rewards && props.rewards[validator.address]
  const reward = rewardAmount(validatorRewards, network.denom)
  const validatorCommission = props.commission && props.commission[validator.address]
  const commission = rewardAmount(validatorCommission, network.denom, 'commission')

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
    return `Delegate to  ${validator.moniker}`
  }

  function onDelegate(){
    setAction()
    props.onDelegate()
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
              buttonText="Redelegate" />
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
          <Table>
            <tbody className="table-sm small">
              {network.apyEnabled && (
                <tr>
                  <td scope="row">
                    <TooltipIcon
                      icon={<span className="p-0 text-decoration-underline">APY</span>}
                      identifier="delegations-apy"
                    >
                      <div className="mt-2 text-center">
                        <p>Based on commission, compounding frequency and estimated block times.</p>
                        <p>This is an estimate and best case scenario.</p>
                      </div>
                    </TooltipIcon>
                  </td>
                  <td>
                    {Object.keys(props.validatorApy).length > 0
                      ? props.validatorApy[validator.operator_address]
                        ? <span>{round(props.validatorApy[validator.operator_address] * 100, 2).toLocaleString()}%</span>
                        : "-"
                      : (
                        <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                          <span className="visually-hidden">Loading...</span>
                        </Spinner>
                      )}
                  </td>
                </tr>
              )}
              <tr>
                <td scope="row">Current Delegation</td>
                <td className="text-break"><Coins coins={delegation?.balance || { amount: 0, denom: network.denom }} asset={network.baseAsset} fullPrecision={true} /></td>
              </tr>
              {delegation?.balance?.amount && (
                <tr>
                  <td scope="row">Current Rewards</td>
                  <td>
                    <Coins coins={{ amount: reward, denom: network.denom }} asset={network.baseAsset} fullPrecision={true} />
                  </td>
                </tr>
              )}
              {!!commission && (
                <tr>
                  <td scope="row">Current Commission</td>
                  <td>
                    <Coins coins={{ amount: commission, denom: network.denom }} asset={network.baseAsset} fullPrecision={true} />
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
          <div className="d-flex justify-content-end gap-2">
            {delegation?.balance?.amount && (
              !loading ? (
                <Dropdown>
                  <Dropdown.Toggle
                    variant="secondary"
                    id="dropdown-basic"
                  >
                    Manage
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <ClaimRewards
                      network={network}
                      address={address}
                      wallet={wallet}
                      rewards={[validatorRewards]}
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
                      rewards={[validatorRewards]}
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
                        rewards={[validatorRewards]}
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
            <Button variant="primary" disabled={!wallet?.hasPermission(address, 'Delegate')} onClick={() => setAction('delegate')}>
              Delegate
            </Button>
          </div>
        </>
      )}
    </>
  )
}

export default ValidatorDelegate