# Governance Voting Power Change

## Description

This bot detects changes in voting power for a specific address for a specific Governance protocol

## Supported Chains

- Ethereum
- Polygon
- Fantom
- Optimism
- Avalanche
- Binance Smart Chain
- Arbitrum

## Alerts

- SIGNIFICANT-VOTING-POWER-ACCUMULATION

  - Fired when an address recieves a significant increase in voting power for a protocol
  - Severity is always set to "low"
  - Type is always set to "suspicious"

- SIGNIFICANT-VOTING-POWER-ACCUMULATION-VOTED

  - Fired when an address recieves a significant increase in voting power for a protocol and has voted on the protocol
  - Severity is always set to "medium"
  - Type is always set to "suspicious"

- SIGNIFICANT-VOTING-POWER-ACCUMULATION-DISTRIBUTION

  - Fired when an address recieves a significant increase in voting power for a protocol and then distributing it to other people
  - Severity is always set to "medium"
  - Type is always set to "suspicious"

- SIGNIFICANT-VOTING-POWER-ACCUMULATION-DISTRIBUTION-VOTED
  - Fired when an address recieves a significant increase in voting power for a protocol and then distributing it to other people and then has voted
  - Severity is always set to "medium"
  - Type is always set to "suspicious"

## Test Data

The bot behaviour can be verified with the specified unit tests,
