# Flashloan Detection Bot

## Description

This bot detects if a transaction contains a flashloan and the borrower made significant profit. The percentage threshold is set to 2%.

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

- FLASHLOAN-ATTACK
  - Fired when a transaction contains a flashoan and the borrower made significant profit
  - Severity is always set to "low"
  - Type is always set to "exploit"
  - Metadata:
    - tokens - array of all tokens involved in the transaction

- FLASHLOAN-ATTACK-WITH-HIGH-PROFIT
  - Fired when a transaction contains a flashoan and the borrower made significant profit
  - Severity is always set to "high"
  - Type is always set to "exploit"
  - Metadata:
    - tokens - array of all tokens involved in the transaction

## Test Data

The bot behaviour can be verified with the following transactions:

- 0xe7e0474793aad11875c131ebd7582c8b73499dd3c5a473b59e6762d4e373d7b8 (SaddleFinance exploit)
