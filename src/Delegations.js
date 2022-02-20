import React from 'react'
import Balance from './Balance'

import {
  Table,
  Button
} from 'react-bootstrap'

class Delegations extends React.Component {
  constructor(props) {
    super(props);
    this.restUrl = process.env.REACT_APP_REST_URL
    this.botAddress = process.env.REACT_APP_BOT_ADDRESS
    this.state = {}
  }

  async componentDidMount() {
    this.getGrants()
  }

  componentWillUnmount() {
  }

  async getGrants() {
    const searchParams = new URLSearchParams();
    searchParams.append("grantee", this.botAddress);
    searchParams.append("granter", this.props.address);
    // searchParams.append("msg_type_url", "/cosmos.staking.v1beta1.MsgDelegate");
    fetch(this.restUrl + "/cosmos/authz/v1beta1/grants?" + searchParams.toString())
      .then(res => res.json())
      .then(
        (result) => {
          console.log(result)
          this.setState({
            isLoaded: true,
            grants: result
          });
        },
        (error) => {
          this.setState({
            isLoaded: true,
            error
          });
        }
      )
  }

  async setupRestake() {
    console.log(this.props.stargateClient)
  }

  render() {
    if (!this.state.isLoaded) {
      return (
        <p>Loading...</p>
      )
    }
    if (this.state.error) {
      return (
        <p>Loading failed</p>
      )
    }

    const listItems = this.props.delegations && Object.entries(this.props.delegations).map(([validator_address, item], i) => {
      const validator = this.props.validators[item.delegation.validator_address]
      // const grants =
      if(validator)
        return (
          <tr key={validator.operator_address}>
            <td>{validator.description.moniker}</td>
            <td><Balance coins={item.balance} /></td>
            <td>
              <Button onClick={() => this.setupRestake()}>
                Setup REStake
              </Button>
            </td>
          </tr>
        )
      else
        return ''
    })

    return (
      <Table>
        <tbody>
          {listItems}
        </tbody>
      </Table>
    )
  }
}

export default Delegations;
