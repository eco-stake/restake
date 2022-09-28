import React, { useState, useMemo } from 'react';

import {
  Modal,
  Button,
  Spinner
} from 'react-bootstrap'

import {
  isMobile,
  isAndroid,
  saveMobileLinkInfo,
} from "@walletconnect/browser-utils";
import QRCode from "qrcode.react";

function ConnectWalletModal(props) {
  const { show, signerProvider, uri, callback, onClose } = props
  const [checkMobile] = useState(() => isMobile());
  const [checkAndroid] = useState(() => isAndroid());

  const navigateToAppURL = useMemo(() => {
    if (checkMobile) {
      if (checkAndroid) {
        const base = "intent://wcV1#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;"
        // Save the mobile link.
        saveMobileLinkInfo({
          name: "Keplr",
          href: base,
        });

        return uri ? `intent://wcV1?${uri}#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;` : base
      } else {
        // Save the mobile link.
        const base = "keplrwallet://wcV1"
        saveMobileLinkInfo({
          name: "Keplr",
          href: base,
        });

        return uri ? `keplrwallet://wcV1?${uri}` : base
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
