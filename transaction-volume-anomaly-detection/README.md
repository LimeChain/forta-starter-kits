# Transaction Volume Anomaly Detection

## Description

This bot detects Transactions with Anomalies in Volume

## Arima Configuration Settings Description:

- p - the number of lag observations (probably > 1 because there is a lot of variance)
- d - the number of times that the raw observations are differenced (probably 0)
- q - the size of the moving average window (probably > 1 because there is a lot of variance)
- P - the number of seasonal lag observations (2 because we want to check the last 2 weeks)
- D - the number of seasonal differences (probably 0)
- Q - the number of seasonal moving average window (2 because we want to check the last 2 weeks)
- s - The number of time steps for a single seasonal period (should be selected such that 1 season is 1 week)

## Supported Chains

- Ethereum
- Binance Smart Chain
- Polygon
- Optimism
- Arbitrum
- Avalanche
- Fantom

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
