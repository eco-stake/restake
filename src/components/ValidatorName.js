function ValidatorName(props) {
  const { validator, fallback } = props
  if(!validator) return fallback || null
  const moniker = validator.description?.moniker || validator.name || 'Unknown'

  return (
    <span className={props.className}>{moniker}</span>
  );
}

export default ValidatorName