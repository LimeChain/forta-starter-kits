# Malicious Governance Proposal Bot

## Description

This bot detects if a proposal gets submitted with unreasonable parameters

## Supported Chains

- Ethereum
- Optimism
- Binance Smart Chain
- Polygon
- Fantom
- Arbitrum
- Avalanche

## Alerts

- POSSIBLE-MALICIOUS-GOVT-PROPOSAL-CREATED
  - Fired when a proposal gets submitted with unreasonable parameters
  - Severity is always set to "high"
  - Type is always set to "exploit"

## [Bot Setup Walkthrough](SETUP.md)

## Test Data

The agent behaviour can be verified with the following transactions:

- 0x00723e6da4a7a3d13735ee82065069bcd47d92a67460a6021310a3380c7ba339 (set fee to 100); The comp example config should be used
- 0x894bd759984f5e44e040311169baa2bb18c0cc4ccdbdb4019d56c10c193be8ce (burn 3M LDO); The aragon example config should be used
