import React from 'react'
import {
  BookmarkPlus,
  BookmarkPlusFill
} from 'react-bootstrap-icons'
import TooltipIcon from './TooltipIcon'

function Favourite(props) {
  const { favourites, value, toggle, label } = props
  const key = props.key || 'address'
  const favourited = favourites.some(el => el[key] === value)
  const className = `${props.className} favourite-${favourited ? 'on' : 'off'}`
  return (
    <TooltipIcon tooltip={`${favourited ? 'Remove saved address' : 'Save address'}`}>
      <div role="button" onClick={() => toggle(value, label)} className={className}>
        <BookmarkPlusFill width={20} height={20} className="on" />
        <BookmarkPlus width={20} height={20} className="off" />
      </div>
    </TooltipIcon>
  )
}

export default Favourite