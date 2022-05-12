const {
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
} = require("forta-agent");
const {
  getDexAndCexAddresses,
  ApprovalThreshold,
  ApprovalTimePeriod,
} = require("./agent.config");
const AddressApprovalTracker = require("./AddressApprovalTracker");
const eventABIs = [
  "event Approval(address indexed owner,address indexed spender,uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
let DEX_AND_CEX_ADDRESSES = [];
const addressesTracked = {};
let isRunning = false;
let result = [];

const initialize = async () => {
  const { chainId } = await getEthersProvider().getNetwork();
  DEX_AND_CEX_ADDRESSES = getDexAndCexAddresses(chainId);
};

const provideHandleTransaction = (addressesTracked) => {
  return async function handleTransaction(txEvent) {
    const findings = [];

    const filtered = txEvent.filterLog(eventABIs);

    for (let tx of filtered) {
      const targetAssetAddress = tx.address;
      const { name } = tx;
      const { spender } = tx.args;
      const { from } = tx.args;
      const hash = txEvent.hash;
      const targetAddress = spender ? spender : from;

      const exists = addressesTracked.hasOwnProperty(targetAddress);

      if (!exists) {
        addressesTracked[targetAddress] = new AddressApprovalTracker(
          targetAddress,
          ApprovalTimePeriod
        );
      }

      if (name == "Approval") {
        if (!DEX_AND_CEX_ADDRESSES.includes(spender)) {
          addressesTracked[targetAddress].addToApprovals(
            targetAssetAddress,
            spender,
            hash
          );
        }
      } else if (name == "Transfer") {
        if (!DEX_AND_CEX_ADDRESSES.includes(spender)) {
          addressesTracked[targetAddress].addToTransfers(
            targetAssetAddress,
            from,
            hash
          );
        }
      }
    }

    return findings;
  };
};

const provideHandleBlock = (addressesTracked) => {
  return async function handleBlock(blockEvent) {
    let findings = [];
    if (!isRunning) {
      runJob(addressesTracked);
    }

    if (result.length > 0) {
      findings = result;
      result = [];
    }
    return findings;
  };
};
const runJob = (addressesTracked) => {
  isRunning = true;

  for (let [key, addressTracked] of Object.entries(addressesTracked)) {
    const AddressApprovalTrackerForObj = addressTracked;
    const approvalCount = AddressApprovalTrackerForObj.getApprovalCount();
    const TransfersWithApprovedAssetsHappened =
      AddressApprovalTrackerForObj.transfersWithApprovedAssetsHappened();
    if (approvalCount > ApprovalThreshold) {
      const {
        toAddress,
        startHash,
        endHash,
        assetsImpacted,
        accountApproved,
        assetsImpactedCount,
      } = AddressApprovalTrackerForObj.getApprovedForFlag();

      result.push(
        Finding.fromObject({
          name: "High number of accounts granted approvals for digital assets",
          description: `${toAddress} obtained transfer approval for ${assetsImpactedCount} assets by ${accountApproved} accounts over period of ${
            ApprovalTimePeriod / (24 * 60 * 60)
          } days`,
          alertId: "ICE-PHISHING-HIGH-NUM-APPROVALS",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            FIRST_TRANSACTION_HASH: startHash,
            LAST_TRANSACTION_HASH: endHash,
            ASSETS_IMPACTED: assetsImpacted,
          },
        })
      );
    }
    if (TransfersWithApprovedAssetsHappened) {
      const {
        toAddress,
        startHash,
        endHash,
        assetsImpacted,
        assetsImpactedCount,
        accountsImpacted,
      } = AddressApprovalTrackerForObj.getApprovedTransferedForFlag();
      if (toAddress) {
        result.push(
          Finding.fromObject({
            name: "Previously approved assets transferred",
            description: `${toAddress} transferred ${assetsImpactedCount} assets from ${accountsImpacted} accounts over period of ${
              ApprovalTimePeriod / (24 * 60 * 60)
            } days`,
            alertId: "ICE-PHISHING-HIGH-NO-APPROVALS",
            severity: FindingSeverity.High,
            type: FindingType.Exploit,
            metadata: {
              FIRST_TRANSACTION_HASH: startHash,
              LAST_TRANSACTION_HASH: endHash,
              ASSETS_IMPACTED: assetsImpacted,
            },
          })
        );
      }
    }
  }
  isRunning = false;
};

module.exports = {
  handleTransaction: provideHandleTransaction(addressesTracked),
  handleBlock: provideHandleBlock(addressesTracked),
  initialize,
  provideHandleTransaction,
  provideHandleBlock,
};
