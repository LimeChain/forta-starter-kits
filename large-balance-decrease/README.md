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

Describe each of the type of alerts fired by this bot

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

## [Bot Setup Walkthrough](SETUP.md)

## Test Data

The bot behaviour can be verified with the following commands:
  - `npm run block 13158432,13176177,13182676,13202391,13204222,13209657,13210732,13227537,13249184,13261896,13266552,13278108,13278248,13299220,13318971,13333652,13342229,13365887,13388139,13406596,13428536,13448391,13453200,13466158,13484500,13484904,13499798,13510000`. Note: you have to change the contractAddress to `0xe89a6d0509faf730bd707bf868d9a2a744a363c7` and the aggregationTimePeriod to `86400`