//
// Markdown Workbench
//
// Copyright (c) 2025 Dave Page
//
// This software is released under the PostgreSQL License.
// See LICENSE.md for details.
//

import React, { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  adFree: boolean;
  onPurchaseRemoveAds: () => void;
  onRestorePurchases: () => void;
}

// Google AdSense configuration.
// Set these to your AdSense publisher ID and ad slot before building for
// the Mac App Store.
const ADSENSE_PUBLISHER_ID = 'ca-pub-7509009547019933';
const ADSENSE_AD_SLOT = '7276739536';

let adSenseScriptLoaded = false;

function loadAdSenseScript(): void {
  if (adSenseScriptLoaded) return;
  adSenseScriptLoaded = true;
  const script = document.createElement('script');
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`;
  script.async = true;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

const AdBanner: React.FC<AdBannerProps> = ({ adFree, onPurchaseRemoveAds, onRestorePurchases }) => {
  const adRef = useRef<HTMLDivElement>(null);
  const isPackaged = (window as any).electronAPI?.isPackaged ?? false;
  const [visible, setVisible] = useState(!adFree);

  useEffect(() => {
    setVisible(!adFree);
  }, [adFree]);

  useEffect(() => {
    // In production, load the AdSense script and initialize the ad
    if (isPackaged && !adFree && adRef.current) {
      loadAdSenseScript();
      try {
        const ins = adRef.current.querySelector('ins.adsbygoogle');
        if (ins && !(ins as any).dataset.adsbygoogleStatus) {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        }
      } catch {
        // AdSense may fail in sandbox — silently ignore
      }
    }
  }, [isPackaged, adFree]);

  if (!visible) {
    return null;
  }

  return (
    <div className="ad-banner">
      <div className="ad-banner-content">
        {isPackaged ? (
          <div ref={adRef}>
            <ins
              className="adsbygoogle"
              style={{ display: 'inline-block', width: '728px', height: '90px' }}
              data-ad-client={ADSENSE_PUBLISHER_ID}
              data-ad-slot={ADSENSE_AD_SLOT}
            />
          </div>
        ) : (
          <div className="ad-banner-placeholder">
            Ad Placeholder
          </div>
        )}
      </div>
      <div className="ad-banner-actions">
        <button className="ad-banner-link" onClick={onPurchaseRemoveAds}>
          Remove Ads
        </button>
        <button className="ad-banner-link" onClick={onRestorePurchases}>
          Restore Purchase
        </button>
      </div>
    </div>
  );
};

export default AdBanner;
