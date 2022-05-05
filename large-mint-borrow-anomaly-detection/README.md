# Large Mint/Borrow Value Anomaly Detection

## Description

This agent detects Transactions with Anomalies in Volume for Mints/Borrows

## Supported Chains

- Ethereum
- Binance Smart Chain
- Polygon
- Optimism
- Arbitrum

## Alerts

- HIGH-MINT-VALUE

  - Fired when there is unusually high number of mints from an address
  - Severity is always set to "medium"
  - Type is always set to "exploit"
  - Metadata fields:
    - FIRST_TRANSACTION_HASH (first hash when it occured)
    - LAST_TRANSACTION_HASH (last hash when it occured)
    - ASSET_IMPACTED (address of the impaced asset)
    - BASELINE_VOLUME (the normal volume)

- HIGH-BORROW-VALUE

  - Fired when there is unusually high number of borrows from an address
  - Severity is always set to "medium"
  - Type is always set to "exploit"
  - Metadata fields:
    - FIRST_TRANSACTION_HASH (first hash when it occured)
    - LAST_TRANSACTION_HASH (last hash when it occured)
    - ASSET_IMPACTED (address of the impaced asset)
    - BASELINE_VOLUME (the normal volume)

## Test Data

The agent behaviour can be verified with supplied unit tests
