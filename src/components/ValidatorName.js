import {
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap'

function ValidatorName(props) {
  const { validator, hideWarning, fallback } = props
  if(!validator) return fallback || null
  const moniker = validator.description?.moniker || validator.name || 'Unknown'

  let warning = false
  let warningClass

  if(validator.status !== 'BOND_STATUS_BONDED') warning = 'Validator is not in the active set'
  if(validator.jailed) warning = 'Validator is jailed'

  if(!hideWarning){
    if (warning) warningClass = 'text-danger'
    if (validator.jailed) warningClass = warningClass + '  text-decoration-line-through'
  }

  return (
    <>
      {warning 
      ? (
        <OverlayTrigger
          key={`validator-warning-${validator.address}`}
          placement="top"
          overlay={
            <Tooltip id={`validator-warning-${validator.address}`}>
              {warning}
            </Tooltip>
          }
        ><span className={warningClass}>{moniker}</span></OverlayTrigger>
      ) : moniker }
    </>
  );
}

export default ValidatorName