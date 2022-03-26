function ValidatorImage(props) {
  const className = props.className || ''
  const defaultSize = !props.width || props.width > 30 ? 'lg' : 'sm'
  return (
    <>
      {props.imageUrl
        ? <img className={'rounded-circle border border-light ' + className} width={props.width || 40} height={props.height || 40} src={props.imageUrl} />
        : <span className={`btn-circle btn-circle-${defaultSize} text-center bg-light rounded-circle border border-light d-inline-block ` + className}><i className="bi bi-person-lines-fill"></i></span>
          }
    </>
  );
}

export default ValidatorImage
