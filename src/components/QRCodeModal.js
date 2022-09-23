import React, { useState, useMemo, useEffect } from 'react';

import {
  Modal,
  Button
} from 'react-bootstrap'

import {
  isMobile,
  isAndroid,
  saveMobileLinkInfo,
} from "@walletconnect/browser-utils";
import QRCode from "qrcode.react";

function QRCodeModal(props) {
  const { uri, callback, onClose } = props
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
    if (navigateToAppURL) {
      window.location.href = navigateToAppURL;
    }
  }, [navigateToAppURL]);

  const handleClose = () => {
    onClose()
    callback()
  }

  return (
    <>
      <Modal size="md" show={!!uri} onHide={handleClose}>
        {!checkMobile ? (
          <>
            <Modal.Header closeButton>
              <Modal.Title className="text-truncate pe-4">
                Scan QR Code
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {uri && (
                <div className="text-center">
                  <QRCode size={300} value={uri} />
                </div>
              )}
            </Modal.Body>
          </>
        ) : (
          <>
            <Modal.Header closeButton>
              <Modal.Title className="text-truncate pe-4">
                Open App
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Button
                onClick={() => {
                  if (navigateToAppURL) {
                    window.location.href = navigateToAppURL;
                  }
                }}
              >
                Open App
              </Button>
            </Modal.Body>
          </>
        )}
      </Modal>
    </>
  );
}

export default QRCodeModal
