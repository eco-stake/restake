import React, { useState, useMemo } from 'react';

import {
  Modal,
  Button,
  Spinner
} from 'react-bootstrap'

import {
  isMobile,
  isAndroid
} from "@walletconnect/browser-utils";
import QRCode from "qrcode.react";

function ConnectWalletModal(props) {
  const { show, signerProvider, uri, callback, onClose } = props
  const [checkMobile] = useState(() => isMobile());
  const [checkAndroid] = useState(() => isAndroid());

  const navigateToAppURL = useMemo(() => {
    if (checkMobile) {
      const uriStr = uri ? `?${uri}` : ''
      if (checkAndroid) {
        return `intent://wcV1${uriStr}#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;`
      } else {
        return `keplrwallet://wcV1${uriStr}`
      }
    }
  }, [checkAndroid, checkMobile, uri]);

  function handleClose() {
    onClose();
    callback && callback();
  }

  function forceDisconnect() {
    signerProvider?.forceDisconnect()
    handleClose()
  }

  const walletName = signerProvider?.label || 'Wallet'
  const title = !checkMobile && uri ? 'Scan QR Code' : `Connect ${walletName}`

  return (
    <>
      <Modal size="md" show={show} onHide={handleClose}>
        <>
          <Modal.Header closeButton>
            <Modal.Title className="text-truncate pe-4">
              {title}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="text-center">
              <p>{`Open your ${walletName} app to continue...`}</p>
              {checkMobile ? (
                <Button
                  onClick={() => {
                    if (navigateToAppURL) {
                      window.location.href = navigateToAppURL;
                    }
                  }}
                >
                  Open App
                </Button>
              ) : (
                uri ? (
                  <div className="text-center">
                    <QRCode size={300} value={uri} />
                  </div>
                ) : (
                  <Spinner animation="border" role="status" className="spinner-border-sm">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                )
              )}
              {!uri && (
                <p className="mt-5">
                  <Button size="sm" onClick={forceDisconnect} variant="danger">Disconnect session</Button>
                </p>
              )}
            </div>
          </Modal.Body>
        </>
      </Modal>
    </>
  );
}

export default ConnectWalletModal
