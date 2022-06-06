# Transaction Volume Anomaly Detection

## Description

This bot detects Transactions with Anomalies in Volume - template

## Supported Chains

- Ethereum
- Binance Smart Chain
- Polygon
- Optimism
- Arbitrum
- Fantom
- Avalanche

## Alerts

- SUCCESSFUL-INTERNAL-TRANSACTION-VOL-INCREASE

  - Fired when there is unusually high number of successful internal transactions
  - Severity is always set to "low"
  - Type is always set to "suspicious"
  - Metadata fields:
    - COUNT (Current count of successful transaction)
    - EXPECTED_BASELINE (Expected baseline count of successful transaction)

- SUCCESSFUL-TRANSACTION-VOL-INCREASE

  - Fired when there is unusually high number of successful transactions
  - Severity is always set to "low"
  - Type is always set to "suspicious"
  - Metadata fields:
    - COUNT (Current count of successful transaction)
    - EXPECTED_BASELINE (Expected baseline count of successful transaction)

- FAILED-TRANSACTION-VOL-INCREASE

  - Fired when there is unusually high number of failed transactions
  - Severity is always set to "high"
  - Type is always set to "exploit"
  - Metadata fields:
    - COUNT (Current count of successful transaction)
    - EXPECTED_BASELINE (Expected baseline count of successful transaction)

- FAILED-INTERNAL-TRANSACTION-VOL-INCREASE

  - Fired when there is unusually high number of failed internal transactions
  - Severity is always set to "medium"
  - Type is always set to "suspicious"
  - Metadata fields:
    - COUNT (Current count of successful transaction)
    - EXPECTED_BASELINE (Expected baseline count of successful transaction)

## Test Data

The agent behaviour can be verified with supplied unit tests
