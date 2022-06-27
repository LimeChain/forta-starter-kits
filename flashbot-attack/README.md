# Flashbot Attack Bot

## Description

This bot detects flashbot transactions

## Supported Chains

- Ethereum

## Alerts

- FLASHBOT-TRANSACTION
  - Fired when the Flashbots API flags a transaction as a flashbot tx
  - Severity is always set to "low"
  - Type is always set to "info"
  - Metadata:
    - from - the address that initiated the tx
    - to - the address that was interacted with
    - hash - the transaction hash

## Test Data

The bot behaviour can be verified with the provided unit tests
