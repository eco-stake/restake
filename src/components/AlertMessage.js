import React, { useState, useEffect } from 'react';

import {
  Alert
} from 'react-bootstrap'

function AlertMessage(props) {
  const [show, setShow] = useState(false);

  const dismissible = props.dismissible === false ? false : true

  useEffect(() => {
    setShow(!!props.message || !!props.children)
  }, [props.message, props.children]);

  function onClose(){
    setShow(false)
    props.onClose && props.onClose()
  }

  return (
    <>
      {show &&
      <Alert className={`text-center ${props.className}`} variant={props.variant || 'danger'} onClose={onClose} dismissible={dismissible}>
        {props.message || props.children}
      </Alert>
      }
    </>
  );
}

export default AlertMessage
