# Drastic Price Change Anomaly Detection Bot

## Description

This bot detects if the price of an asset changes drastically or there is a large discrepancy between an on-chain and an off-chain oracle 

## Supported Chains

- Ethereum (For now)

## Alerts

- PRICE-DISCREPANCIES
  - Fired when there is a large discrepancy between an on-chain and an off-chain oracle
  - Severity is always set to "high"
  - Type is always set to "suspicious"

- PRICE-FLUCTUATIONS
  - Fired when the price of an asset changes drastically
  - Severity is always set to "low"
  - Type is always set to "suspicious"

## Test Data

The agent behaviour can be verified with the following transactions:

- 0x3a0f757030beec55c22cbc545dd8a844cbbb2e6019461769e1bc3f3a95d10826 (15,000 USDT)
