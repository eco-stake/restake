import Coins from './Coins'

import {
  Table,
  Button
} from 'react-bootstrap'

function Validators(props) {
  const listItems = props.validators && Object.entries(props.validators).map(([validator_address, item], i) => {
    const delegation = props.delegations && props.delegations[validator_address]
    if(delegation) return null
    return (
      <tr key={item.operator_address}>
        <td>{item.description.moniker}</td>
        <td>
          <Button onClick={() => props.selectValidator(item)}>
            Delegate
          </Button>
        </td>
      </tr>
    )
  })

  return (
    <Table>
      <thead>
        <tr>
          <td>Validator</td>
          <td></td>
        </tr>
      </thead>
      <tbody>
        {listItems}
      </tbody>
    </Table>
  )
}

export default Validators;
