# Flashloan Detection Bot

## Description

This bot detects if a transaction contains a flashloan and the borrower made significant profit

## Supported Chains

- Ethereum

## Alerts

Describe each of the type of alerts fired by this agent

- FLASHLOAN-ATTACK
  - Fired when a transaction contains a flashoan and the borrower made significant profit
  - Severity is always set to "high"
  - Type is always set to "exploit"
  - Metadata:
    - tokens - array of all tokens involved in the transaction

## Test Data

The agent behaviour can be verified with the following transactions:

- 0x0fe2542079644e107cbf13690eb9c2c65963ccb79089ff96bfaf8dced2331c92 (CREAM exploit) - No alert because the profit is ~1.5%
- 0xe7e0474793aad11875c131ebd7582c8b73499dd3c5a473b59e6762d4e373d7b8 (SaddleFinance exploit)
