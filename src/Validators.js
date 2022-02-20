import Balance from './Balance'

import {
  Table,
  Button
} from 'react-bootstrap'

function Validators(props) {
  const listItems = props.validators && Object.entries(props.validators).map(([validator_address, item], i) => {
    const delegation = props.delegations && props.delegations[validator_address]
    return (
      <tr key={item.operator_address}>
        <td>{item.description.moniker}</td>
        <td>{delegation && <Balance coins={delegation.balance} />}</td>
        <td>
        </td>
      </tr>
    )
  })

  return (
    <Table>
      <tbody>
        {listItems}
      </tbody>
    </Table>
  )
}

export default Validators;
