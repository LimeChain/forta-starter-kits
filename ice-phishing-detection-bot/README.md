# Ice Phishing Detection Bot

## Description

This bot detects high approvals for a specific account and if any assets are transfered

## Supported Chains

- Ethereum
- Binance Smart Chain
- Polygon
- Arbitrum
- Optimism
- Fantom

## Alerts

- ICE-PHISHING-HIGH-NUM-APPROVALS

  - Fired when an address suddenly has a higher amount of approvals
  - Severity is always set to "low"
  - Type is always set to "suspicious"
  - Metadata fields:
    - FIRST_TRANSACTION_HASH (the transaction that was first found)
    - LAST_TRANSACTION_HASH (the tranaction that was found last)
    - ASSETS_IMPACTED (the amount of assets that were impacted)

- ICE-PHISHING-PREV-APPROVED-TRANSFERED
  - Fired when an address that was flagged transfers assets from the previously approved list
  - Severity is always set to "high"
  - Type is always set to "exploit"
  - Metadata fields:
    - FIRST_TRANSACTION_HASH (the transaction that was first found)
    - LAST_TRANSACTION_HASH (the tranaction that was found last)
    - ASSETS_IMPACTED (the amount of assets that were impacted)

## Test Data

The bot behaviour can be verified with the provided unit tests and the provided block range:

- 13650638..13724086 (BADGERDAO HACK, ethereum)
