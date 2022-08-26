# Asset Drained Bot

## Description

This bot detects if an asset is fully drained from a contract

## Supported Chains

- Ethereum
- Binance Smart Chain
- Fantom
- Avalanche

## Alerts

- ASSET-DRAINED
  - Fired when an asset is fully drained from a contract
  - Severity is always set to "high"
  - Type is always set to "suspicious"
  - Metadata:
    - contract - the contract's address
    - asset - the asset's address

## Test Data

The agent behaviour can be verified by running `npm run block 13499798,13499799` (CREAM exploit).
Every block we process the transactions from the previous one so when testing you should provide the exploit block and the next one.
