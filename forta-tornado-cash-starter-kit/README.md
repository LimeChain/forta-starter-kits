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

The bot behaviour can be verified with the following transactions:

- 0x1ec1d8e073fa2476799e48a6a33b272aa28431261598b4fc93f63c58aae571f2 (returns contract interactions from tx to now, ethereum)
- 0x8c5e39abbbecefcd80684a8a241f5e11e2506bf73166ed473d666fb367c10f0d (returns contract interactions from tx to now, binance smart chain)
- 0x458ccb3fedf31e3423c20647a089f20402a43310667d1896e6b4eff42f46f38c (returns contract interactions from tx to now, optimism)
- 0x269ab0c4b30eede3c3d64e4b4df641657b89c18db49c3fbd5ee1ead7fa21f146 (returns contract interactions from tx to now, polygon)
- 0xc82b4890610b487cffb27bf93ae2a904fb391cb8dc2dd5bad1e300e81cab443e (returns contract interactions from tx to now, arbitrum)

This bot behaviour can be verified with the following block range:

- 14747739..14747745 (ethereum)
