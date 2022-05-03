# Ice Phishing Detection Bot

## Description

This agent detects high approvals for a specific account and if any assets are transfered

## Supported Chains

- Ethereum
- Binance Smart Chain
- Polygon
- Arbitrum
- Optimism

## Alerts

- ICE-PHISHING-HIGH-NUM-APPROVALS

  - Fired when an address suddenly has a higher amount of approvals
  - Severity is always set to "low"
  - Type is always set to "suspicious"
  - Metadata fields:
    - FIRST_TRANSACTION_HASH (the transaction that was first found)
    - LAST_TRANSACTION_HASH (the tranaction that was found last)
    - ASSETS_IMPACTED (the amount of assets that were impacted)

- ICE-PHISHING-HIGH-NO-APPROVALS
  - Fired when an address that was flagged transfers assets from the previously approved list
  - Severity is always set to "high"
  - Type is always set to "exploit"
  - Metadata fields:
    - FIRST_TRANSACTION_HASH (the transaction that was first found)
    - LAST_TRANSACTION_HASH (the tranaction that was found last)
    - ASSETS_IMPACTED (the amount of assets that were impacted)

## Test Data

The agent behaviour can be verified with the provided unit tests and with the following block range:

- 14703440..14703470 (ethereum)
- 27870000..27870046 (polygon)
- 17479000..17479022 (bsc)
