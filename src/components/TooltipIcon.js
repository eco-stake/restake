import {
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap'

function TooltipIcon(props) {
  if(!props.tooltip && !props.children) return props.icon
  if(!props.icon && !props.children) return null
  return (
    <>
      <OverlayTrigger
        key={props.identifier}
        placement={props.placement || 'top'}
        rootClose={props.rootClose}
        overlay={
          <Tooltip id={`tooltip-${props.key}`}>
            {props.tooltip || props.children}
          </Tooltip>
        }
      >{props.icon || props.children}</OverlayTrigger>
    </>
  )
}

export default TooltipIcon
