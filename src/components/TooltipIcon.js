import {
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap'

function TooltipIcon(props) {

  return (
    <>
      {(props.children || props.tooltip) ? (
      <OverlayTrigger
        key={props.identifier}
        placement="top"
        overlay={
          <Tooltip id={`tooltip-${props.key}`}>
            {props.children || props.tooltip}
          </Tooltip>
        }
      >{props.icon}</OverlayTrigger>
      ) : props.icon}
    </>
  )
}

export default TooltipIcon
