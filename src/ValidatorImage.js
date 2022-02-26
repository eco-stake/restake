import {
} from 'react-bootstrap'

function ValidatorImage(props) {
  return (
    <>
      {props.imageUrl
        ? <img className={'rounded-circle ' + props.className} width={props.width || 30} height={props.height || 30} src={props.imageUrl} alt={props.validator.description.moniker} />
        : <div className={'avatar rounded-circle border-2 border-dashed text-tertiary ' + props.className}></div>
          }
    </>
  );
}

export default ValidatorImage
