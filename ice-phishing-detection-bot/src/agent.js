const { Finding, FindingSeverity, FindingType } = require("forta-agent");
const {
  DEX_AND_CEX_ADDRESSES,
  ApprovalThreshold,
  ApprovalTimePeriod,
} = require("./agent.config");
const AddressApprovalTracker = require("./AddressApprovalTracker");
const eventABIs = [
  "event Approval(address indexed owner,address indexed spender,uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const addressesTracked = [];
let isRunning = false;
let result = [];
const handleTransaction = async (txEvent) => {
  const findings = [];

  if (!DEX_AND_CEX_ADDRESSES.includes(txEvent.from)) {
    const filtered = txEvent.filterLog(eventABIs);

    for (let tx of filtered) {
      const { name } = tx;
      const approvedAsset = txEvent.to;
      const accountApproved = txEvent.from;
      const hash = txEvent.hash;

      const addressTrackedObj = {};
      addressTrackedObj[accountApproved] = new AddressApprovalTracker(
        accountApproved,
        ApprovalTimePeriod
      );

      const foundIndex = addressesTracked.findIndex(
        (a) => Object.keys(a) == accountApproved
      );

      if (name == "Approval") {
        if (foundIndex != -1) {
          addressesTracked[foundIndex][accountApproved].AddToApprovals(
            approvedAsset,
            accountApproved,
            hash
          );
        } else if (foundIndex == -1) {
          addressTrackedObj[accountApproved].AddToApprovals(
            approvedAsset,
            accountApproved,
            hash
          );
          addressesTracked.push(addressTrackedObj);
        }
      } else if (name == "Transfer") {
        if (foundIndex != -1) {
          addressesTracked[foundIndex][accountApproved].AddToTransfers(
            accountApproved,
            approvedAsset,
            hash
          );
        } else if (foundIndex == -1) {
          addressTrackedObj[accountApproved].AddToTransfers(
            accountApproved,
            approvedAsset,
            hash
          );
          addressesTracked.push(addressTrackedObj);
        }
      }
    }
  }

  return findings;
};

const handleBlock = async (blockEvent) => {
  let findings = [];
  if (!isRunning) {
    runJob();
  }

  if (result.length > 0) {
    findings = result;
    result = [];
  }
  return findings;
};

const runJob = () => {
  isRunning = true;
  for (let addressTracked of addressesTracked) {
    const AddressApprovalTrackerForObj = Object.values(addressTracked)[0];
    const approvalCount = AddressApprovalTrackerForObj.GetApprovalCount();
    const IsPastThreshold = AddressApprovalTrackerForObj.IsPastThreshold();
    if (approvalCount > ApprovalThreshold) {
      const { toAddress, startHash, endHash, assetsImpacted, accountApproved } =
        AddressApprovalTrackerForObj.GetApprovedForFlag();

      result.push(
        Finding.fromObject({
          name: "High number of accounts granted approvals for digital assets",
          description: `${toAddress} obtained transfer approval for ${assetsImpacted} assets by ${accountApproved} accounts over period of ${
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
    if (IsPastThreshold) {
      const {
        toAddress,
        startHash,
        endHash,
        assetsImpacted,
        accountsImpacted,
      } = AddressApprovalTrackerForObj.GetApprovedTransferedForFlag();

      result.push(
        Finding.fromObject({
          name: "Previously approved assets transferred",
          description: `${toAddress} transferred ${assetsImpacted} assets from ${accountsImpacted} accounts over period of ${
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
  isRunning = false;
};

module.exports = {
  handleTransaction,
  handleBlock,
};
