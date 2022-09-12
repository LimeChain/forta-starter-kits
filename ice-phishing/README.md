# Ice Phishing Bot

## Description

This bot detects if an account gains high number of approvals and if it transfer the approved funds

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

- ICE-PHISHING-HIGH-NUM-APPROVALS
  - Fired when an account gains high number of approvals
  - Severity is always set to "low"
  - Type is always set to "suspicious"
  - Metadata:
    - firstTxHash - hash of the first approval tx
    - lastTxHash - hash of the last approval tx
    - assetsImpacted - an array of the impacted assets

- ICE-PHISHING-HIGH-NUM-APPROVED-TRANSFERS
  - Fired when an account that gained high number of approvals starts transfering the approved assets
  - Severity is always set to "high"
  - Type is always set to "exploit"
  - Metadata:
    - firstTxHash - hash of the first transfer tx
    - lastTxHash - hash of the last transfer tx
    - assetsImpacted - an array of the impacted assets

- ICE-PHISHING-APPROVAL-FOR-ALL
  - Fired when an account gains approval for all assets
  - Severity is always set to "low"
  - Type is always set to "suspicious"
  - Metadata:
    - spender - the account that received the approval
    - owner - the owner of the assets
    - asset - the approved asset address

## Test Data

The agent behaviour can be verified with the following transactions:

- `npm run tx 0xc45f426dbae8cfa1f96722d5fccfe8036a356b6be2259ac9b1836a9c3286000f,0x70842e12f8698a3a12f8a015579c4152d6e65841d1c18a23e85b5127144a5490,0x5e4c7966b0eaddaf63f1c89fc1c4c84812905ea79c6bee9d2ada2d2e5afe1f34,0x951babdddbfbbba81bbbb7991a959d9815e80cc5d9418d10e692f41541029869,0x36ee80b32a4248c4f1ca70fc78989b3ffe0def0a6824cb8591aff8110170769c,0xe01969b2c7dea539497d0413cf3b53f80a6f793f63637e6747991405e20dcaf4` - BadgerDAO attack
- `npm run tx 0x4ac7bb723c430d47b6871cc475da2661f9f2d848f6d9a220d125f33bc8850f7c,0x8f13bcbd56ef6c4ebdf1c18388ae4510be358b516aef4347b7d989b0340a1ae8,0x43337dadfd774ffdbb883f0935f1ba368d9fceb24a161e157cf4402e824dfbfd,0x519802e340fe178bb573b6ad840a2eb56ba2638cffc5791860aa4af2fa05b398` - Uniswap V3 attack
