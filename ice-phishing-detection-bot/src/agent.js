const {
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
  ethers,
} = require("forta-agent");
const {
  getAPI,
  ApprovalThreshold,
  ApprovalTimePeriod,
  maxTracked,
} = require("./agent.config");
const AddressApprovalTracker = require("./AddressApprovalTracker");
const { default: axios } = require("axios");
const eventABIs = [
  "event Approval(address indexed owner,address indexed spender,uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];
let valid_contracts = new Set();
let invalid_addresses = new Set();
let address_queue = new Set();
const addressesTracked = {};
let isRunning = false;
let isRunningAddressQueue = false;
let result = [];
let provider;
let apiKey = "";
let apiURI = "";
let apiCalls = 0;

const validContract = async (contractAddress) => {
  if (contractAddress == ethers.constants.AddressZero) {
    return null;
  }
  const contractCode = await provider.getCode(contractAddress);
  if (apiCalls >= 5) {
    address_queue.add(contractAddress);
    setTimeout(() => {
      apiCalls = 0;
    }, 1000);
    return null;
  } else if (contractCode != "0x") {
    const result = await axios.get(
      apiURI + `${contractAddress}&apikey=${apiKey}`
    );
    apiCalls++;

    result.data.status == "1"
      ? valid_contracts.add(contractAddress)
      : result.data.status == "0" &&
        result.data.result == "Max rate limit reached"
      ? address_queue.add(contractAddress)
      : invalid_addresses.add(contractAddress);
  }
  if (valid_contracts.size > maxTracked) {
    const valid_contracts_asArr = [...valid_contracts];
    valid_contracts_asArr.shift();
    valid_contracts = new Set(valid_contracts_asArr);
  }
  if (invalid_addresses.size > maxTracked) {
    const invalid_addresses_asArr = [...invalid_addresses];
    invalid_addresses_asArr.shift();
    invalid_addresses = new Set(invalid_addresses_asArr);
  }
};

const initialize = async () => {
  provider = await getEthersProvider();
  const { chainId } = await provider.getNetwork();
  const { APIKey, API_URI } = getAPI(chainId);
  apiKey = APIKey;
  apiURI = API_URI;
};

const provideHandleTransaction = (addressesTracked, validContract) => {
  return async function handleTransaction(txEvent) {
    const findings = [];

    const filtered = txEvent.filterLog(eventABIs);

    for (let tx of filtered) {
      const targetAssetAddress = tx.address;
      const { name } = tx;
      const { spender } = tx.args;
      const { from, to } = tx.args;
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
        if (!valid_contracts.has(spender) && !invalid_addresses.has(spender)) {
          await validContract(spender);
        }
        if (!valid_contracts.has(spender)) {
          addressesTracked[targetAddress].addToApprovals(
            targetAssetAddress,
            spender,
            hash
          );
        }
      } else if (name == "Transfer") {
        if (!valid_contracts.has(to) && !invalid_addresses.has(to)) {
          await validContract(to);
        }
        if (!valid_contracts.has(to)) {
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

const provideHandleBlock = (addressesTracked, validContract) => {
  return async function handleBlock(blockEvent) {
    let findings = [];
    if (!isRunning) {
      runJob(addressesTracked);
    }
    if (!isRunningAddressQueue) {
      addressQueueRuntimeJob(validContract);
    }
    if (result.length > 0) {
      findings = result;
      result = [];
    }

    return findings;
  };
};

const addressQueueRuntimeJob = (validContract) => {
  isRunningAddressQueue = true;
  const addresses = [...address_queue];
  address_queue = new Set();

  for (let address of addresses) {
    const isFull = await validContract(address);
    if (isFull) {
      isRunningAddressQueue = false;
      break;
    }
  }
  isRunningAddressQueue = false;
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
  handleTransaction: provideHandleTransaction(addressesTracked, validContract),
  handleBlock: provideHandleBlock(addressesTracked, validContract),
  initialize,
  provideHandleTransaction,
  provideHandleBlock,
};
