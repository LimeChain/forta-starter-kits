# Large Balance Decrease Bot

## Description

Detects if the balance of a protocol decreases significantly

## Supported Chains

- Ethereum
- Optimism
- Binance Smart Chain
- Polygon
- Fantom
- Arbitrum
- Avalanche

## Alerts

Describe each of the type of alerts fired by this agent

- BALANCE-DECREASE-ASSETS-ALL-REMOVED
  - Fired when the token balance of a protocol is completely drained
  - Severity is always set to "critical"
  - Type is always set to "exploit"
  - Metadata:
    - firstTxHash - the hash of the first transaction for the period
    - lastTxHash - the hash of the last transaction for the period
    - assetImpacted - the drained asset

- BALANCE-DECREASE-ASSETS-PORTION-REMOVED
  - Fired when the token balance of a protocol decreases significantly
  - Severity is always set to "medium"
  - Type is always set to "exploit"
  - Metadata:
    - firstTxHash - the hash of the first transaction for the period
    - lastTxHash - the hash of the last transaction for the period
    - assetImpacted - the impacted asset
    - assetVolumeDecreasePercentage - the decrease percentage

## Test Data

The bot behaviour can be verified with the provided unit tests