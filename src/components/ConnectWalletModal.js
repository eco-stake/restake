import React, { useState, useMemo, useEffect } from 'react';

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
  const { show, walletName, uri, callback, onClose } = props
  const [checkMobile] = useState(() => isMobile());
  const [checkAndroid] = useState(() => isAndroid());

  const navigateToAppURL = useMemo(() => {
    if (uri && checkMobile) {
      if (checkAndroid) {
        // Save the mobile link.
        saveMobileLinkInfo({
          name: "Keplr",
          href:
            "intent://wcV1#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;",
        });

        return `intent://wcV1?${uri}#Intent;package=com.chainapsis.keplr;scheme=keplrwallet;end;`;
      } else {
        // Save the mobile link.
        saveMobileLinkInfo({
          name: "Keplr",
          href: "keplrwallet://wcV1",
        });

        return `keplrwallet://wcV1?${uri}`;
      }
    }
  }, [checkAndroid, checkMobile, uri]);

  useEffect(() => {
    // Try opening the app without interaction.
    if (uri && navigateToAppURL) {
      window.location.href = navigateToAppURL;
    }
  }, [uri, navigateToAppURL]);

  const handleClose = () => {
    onClose()
    callback && callback()
  }

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
            {uri ? (
              checkMobile ? (
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
                <div className="text-center">
                  <QRCode size={300} value={uri} />
                </div>
              )
            ) : (
              <div className="text-center">
                <p>{`Open your ${walletName} app to continue...`}</p>
                <Spinner animation="border" role="status" className="spinner-border-sm">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              </div>
            )}
          </Modal.Body>
        </>
      </Modal>
    </>
  );
}

export default ConnectWalletModal
