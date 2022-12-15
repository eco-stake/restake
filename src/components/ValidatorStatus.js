function ValidatorStatus(props) {
  const { validator } = props
  if (!validator) return null

  const status = validator.active ? 'Active' : validator.jailed ? 'Jailed' : validator.active != null ? 'Inactive' : 'Unknown'
  let className = validator.active ? '' : 'text-danger'

  return <span className={className}>{status}</span>
}

export default ValidatorStatus