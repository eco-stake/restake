import ValidatorName from "./ValidatorName"

function ValidatorLink(props) {
  let validator = props.validator
  if(!validator && props.operator) validator = props.operator
  if(!validator) return props.fallback || null

  const website = () => {
    let url = validator.description && validator.description.website
    if(!url) return

    return url.startsWith('http') ? url : ('https://' + url)
  }

  if(!website()){
    return props.children || <ValidatorName validator={validator} hideWarning={props.hideWarning} />
  }

  return (
    <a href={website()} target="_blank" rel="noreferrer" className={[props.className, "text-reset text-decoration-none"].join(' ')}>
      {props.children || <ValidatorName validator={validator} hideWarning={props.hideWarning} />}
    </a>
  );
}

export default ValidatorLink
