import React, { useState } from 'react';

import CopyToClipboard from 'react-copy-to-clipboard';
import {
  Clipboard,
  ClipboardCheck,
} from 'react-bootstrap-icons'

import TooltipIcon from './TooltipIcon';
import { truncateAddress } from '../utils/Helpers.mjs';

function Address(props) {
  const { address } = props
  const [copied, setCopied] = useState(false)

  function setCopiedTimeout() {
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const Element = props.as ? props.as : 'span'
  const className = [`address-container d-flex align-items-center hover-show`, props.className].join(' ')

  return (
    <span className={className}>
      <Element className="address" role={props.onClick && 'button'} onClick={props.onClick}>{truncateAddress(address)}</Element>
      <TooltipIcon tooltip="Copy address" rootClose={true}>
        <span className="ms-2">
          <CopyToClipboard text={address}
            onCopy={() => setCopiedTimeout()}>
            <span role="button">{copied ? <ClipboardCheck className="d-block" /> : <Clipboard  className="d-block hover-target"/>}</span>
          </CopyToClipboard>
        </span>
      </TooltipIcon>
      {props.children}
    </span>
  );
}

export default Address