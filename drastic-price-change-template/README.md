# Drastic Price Change Anomaly Detection Bot

## Description

This bot detects if the price of an asset changes drastically or there is a large discrepancy between an on-chain and an off-chain oracle 

## Supported Chains

- Ethereum
- Optimism
- Binance Smart Chain
- Polygon
- Fantom
- Arbitrum
- Avalanche

## Alerts

- PRICE-DISCREPANCIES
  - Fired when there is a large discrepancy between an on-chain and an off-chain oracle
  - Severity is always set to "high"
  - Type is always set to "suspicious"

- PRICE-FLUCTUATIONS
  - Fired when the price of an asset changes drastically
  - Severity is always set to "low"
  - Type is always set to "suspicious"

## [Bot Setup Walkthrough](SETUP.md)

## Test Data

The bot behaviour can be verified with the provided unit tests
