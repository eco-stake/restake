import React from 'react'
import Coins from './Coins'

import {
  Table,
  Button
} from 'react-bootstrap'

class Delegations extends React.Component {
  constructor(props) {
    super(props);
    this.state = {restake: []}
  }

  componentDidMount() {
  }

  componentWillUnmount() {
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

  restakePercentage(){
    return (100.0 / this.state.restake.length).toFixed(2)
  }

  render() {
    if (!this.props.delegations || !this.props.validators) {
      return (
        <p>Loading...</p>
      )
    }

    const listItems = this.props.delegations && Object.entries(this.props.delegations).map(([validator_address, item], i) => {
      const validator = this.props.validators[item.delegation.validator_address]
      if(validator)
        return (
          <tr key={validator.operator_address}>
            <td>{validator.description.moniker}</td>
            <td><Coins coins={item.balance} /></td>
            <td>
              {this.state.restake.includes(validator.operator_address) &&
                <span>{this.restakePercentage()}%</span>}
            </td>
            <td>
              {this.state.restake.includes(validator.operator_address)
                ? <Button className="btn-sm btn-danger" onClick={() => this.removeFromRestake(validator.operator_address)}>
                    Remove from REStake
                  </Button>
                : <Button className="btn-sm" disabled={this.state.restake.length >= 5} onClick={() => this.addToRestake(validator.operator_address)}>
                    Add to REStake
                  </Button>
              }
            </td>
          </tr>
        )
      else
        return ''
    })

    return (
      <Table>
        <thead>
          <tr>
            <th>Validator</th>
            <th>Delegations</th>
            <th>Restake percentage</th>
            <th width={200}></th>
          </tr>
        </thead>
        <tbody>
          {listItems}
        </tbody>
      </Table>
    )
  }
}

export default Delegations;
