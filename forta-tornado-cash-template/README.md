# Tornado Cash funded account interacted with contract

## Description

This bot detects when an account that was funded by Tornado Cash interacts with any contract

## Supported Chains

- Ethereum
- BSC
- Optimism
- Polygon
- Arbitrum

## Alerts

- TORNADO-CASH-FUNDED-ACCOUNT-INTERACTION
  - Fired when a transaction contains contract interactions from a Tornado Cash funded account
  - Severity is always set to "low"
  - Type is always set to "suspicious"

## Test Data

The agent behaviour can be verified with the following transactions:

- 0x58f970044273705ab3b0e87828e71123a7f95c9d (returns contract interactions from tx to now, ethereum)
- 0x0f3470ed99f835c353be12ce0f82f68c1cf8e411 (returns contract interactions from tx to now, binance smart chain)
- 0x458ccb3fedf31e3423c20647a089f20402a43310667d1896e6b4eff42f46f38c (returns contract interactions from tx to now, optimism)
- 0x269ab0c4b30eede3c3d64e4b4df641657b89c18db49c3fbd5ee1ead7fa21f146 (returns contract interactions from tx to now, polygon)
- 0xc82b4890610b487cffb27bf93ae2a904fb391cb8dc2dd5bad1e300e81cab443e (returns contract interactions from tx to now, arbitrum)
