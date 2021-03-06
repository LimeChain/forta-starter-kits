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
const addressesTracked = {};

let valid_contracts = new Set();
let invalid_addresses = new Set();
let address_queue = new Set();
let functionQueue = [];
let isRunning = false;
let isRunningAddressQueue = false;
let isRunningFunctionQueue = false;
let result = [];
let provider;
let apiKey = "";
let apiURI = "";
let apiCalls = 0;
let apiLimitReached = false;

const validContract = async (contractAddress) => {
  if (contractAddress == ethers.constants.AddressZero) {
    return null;
  }
  const contractCode = await provider.getCode(contractAddress);
  if (apiCalls >= 5) {
    address_queue.add(contractAddress);
    if (apiLimitReached) {
      return true;
    } else {
      setTimeout(() => {
        apiCalls = 0;
        apiLimitReached = false;
      }, 1000);
      apiLimitReached = true;
    }
    return true;
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
  return false;
};

const processInvalidAddresses = () => {
  const queue = [...invalid_addresses, ...address_queue];
  invalid_addresses = new Set();
  address_queue = new Set(queue);
  setTimeout(processInvalidAddresses, 18_000_000);
};

const initialize = async () => {
  provider = await getEthersProvider();
  const { chainId } = await provider.getNetwork();
  const { APIKey, API_URI } = getAPI(chainId);
  apiKey = APIKey;
  apiURI = API_URI;
  setTimeout(processInvalidAddresses, 18_000_000);
};

const addToApprovals = (
  addressesTracked,
  address,
  targetAssetAddress,
  spender,
  hash,
  valid_contracts,
  invalid_addresses
) => {
  if (
    !valid_contracts.has(address) &&
    !address_queue.has(address) &&
    invalid_addresses.has(address)
  ) {
    addressesTracked[address].addToApprovals(targetAssetAddress, spender, hash);

    return true;
  } else if (valid_contracts.has(address)) {
    return true;
  }
  return false;
};

const addToTransfers = (
  addressesTracked,
  targetAddress,
  targetAssetAddress,
  from,
  hash,
  valid_contracts,
  invalid_addresses
) => {
  if (
    !valid_contracts.has(targetAddress) &&
    !address_queue.has(targetAddress) &&
    invalid_addresses.has(targetAddress)
  ) {
    addressesTracked[targetAddress].addToTransfers(
      targetAssetAddress,
      from,
      hash
    );
    return true;
  } else if (valid_contracts.has(targetAddress)) {
    return true;
  }
  return false;
};

const provideHandleTransaction = (
  addressesTracked,
  valid_contracts,
  invalid_addresses
) => {
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
          address_queue.add(spender);
          functionQueue.push(() =>
            addToApprovals(
              addressesTracked,
              spender,
              targetAssetAddress,
              spender,
              hash,
              valid_contracts,
              invalid_addresses
            )
          );
        } else {
          addToApprovals(
            addressesTracked,
            spender,
            targetAssetAddress,
            spender,
            hash,
            valid_contracts,
            invalid_addresses
          );
        }
      } else if (name == "Transfer") {
        if (
          !valid_contracts.has(targetAddress) &&
          !invalid_addresses.has(targetAddress)
        ) {
          address_queue.add(targetAddress);
          functionQueue.push(() =>
            addToTransfers(
              addressesTracked,
              targetAddress,
              targetAssetAddress,
              from,
              hash,
              valid_contracts,
              invalid_addresses
            )
          );
        } else {
          addToTransfers(
            addressesTracked,
            targetAddress,
            targetAssetAddress,
            from,
            hash,
            valid_contracts,
            invalid_addresses
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
    if (!isRunningFunctionQueue) {
      functionQueueRuntimeJob();
    }
    if (result.length > 0) {
      findings = result;
      result = [];
    }

    return findings;
  };
};

const addressQueueRuntimeJob = async (validContract) => {
  isRunningAddressQueue = true;
  const addresses = [...address_queue];
  address_queue = new Set();
  console.log("Current Address Validation Queue: ", address_queue.size);
  for (let address of addresses) {
    const isFull = await validContract(address);

    if (isFull) {
      isRunningAddressQueue = false;
      break;
    }
  }
  isRunningAddressQueue = false;
};

const functionQueueRuntimeJob = async () => {
  isRunningFunctionQueue = true;
  console.log("Current function execution queue: ", functionQueue.length);
  if (functionQueue.length > 40_000) {
    functionQueue.pop();
  }
  for (let [index, func] of functionQueue.entries()) {
    if (func != undefined) {
      const processed = func();

      if (processed) {
        console.log("PROCESSED");
        delete functionQueue[index];
      }
    } else {
      break;
    }
  }

  isRunningFunctionQueue = false;
};
const runJob = (addressesTracked) => {
  isRunning = true;

  for (let [key, addressTracked] of Object.entries(addressesTracked)) {
    const AddressApprovalTrackerForObj = addressTracked;
    const approvalCount = AddressApprovalTrackerForObj.getApprovalCount();
    const TransfersWithApprovedAssetsHappened =
      AddressApprovalTrackerForObj.transfersWithApprovedAssetsHappened();

    console.log("Address currently examining:", key);
    console.log("Approval Count:", approvalCount);
    console.log(
      "TransfersWithApprovedAssetsHappened:",
      TransfersWithApprovedAssetsHappened
    );
    console.log("Approval Threshold:", ApprovalThreshold);
    console.log("Should alert approvals:", approvalCount > ApprovalThreshold);
    console.log("Should alert transfers:", TransfersWithApprovedAssetsHappened);

    if (approvalCount > ApprovalThreshold) {
      const {
        toAddress,
        startHash,
        endHash,
        assetsImpacted,
        accountApproved,
        assetsImpactedCount,
        startDate,
        endDate,
      } = AddressApprovalTrackerForObj.getApprovedForFlag();
      const timePassedInDays = Math.floor((endDate - startDate) / (3600 * 24));

      result.push(
        Finding.fromObject({
          name: "High number of accounts granted approvals for digital assets",
          description: `${toAddress} obtained transfer approval for ${assetsImpactedCount} assets by ${accountApproved} accounts over period of ${timePassedInDays} days`,
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
        startDate,
        endDate,
      } = AddressApprovalTrackerForObj.getApprovedTransferedForFlag();
      const timePassedInDays = Math.floor((endDate - startDate) / (3600 * 24));

      if (toAddress) {
        result.push(
          Finding.fromObject({
            name: "Previously approved assets transferred",
            description: `${toAddress} transferred ${assetsImpactedCount} assets from ${accountsImpacted} accounts over period of ${timePassedInDays} days`,
            alertId: "ICE-PHISHING-PREV-APPROVED-TRANSFERED",
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
  handleTransaction: provideHandleTransaction(
    addressesTracked,
    valid_contracts,
    invalid_addresses
  ),
  handleBlock: provideHandleBlock(addressesTracked, validContract),
  initialize,
  provideHandleTransaction,
  provideHandleBlock,
};
