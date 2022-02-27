function ValidatorLink(props) {
  const website = () => {
    let url = props.operator.description && props.operator.description.website
    if(!url) return

    return url.startsWith('http') ? url : ('https://' + url)
  }

  if(!website()){
    return props.children || props.operator.moniker
  }

  return (
    <a href={website()} target="_blank" rel="noreferrer" className={[props.className, "text-dark text-decoration-none"].join(' ')}>
      {props.children || props.operator.moniker}
    </a>
  );
}

export default ValidatorLink
