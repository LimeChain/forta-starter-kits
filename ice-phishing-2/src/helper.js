const {
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
} = require('forta-agent');

// Computes the data needed for an alert
function getEventInformation(eventsArray) {
  const { length } = eventsArray;
  const firstTxHash = eventsArray[0].hash;
  const lastTxHash = eventsArray[length - 1].hash;

  // Remove duplicates
  const assets = [...new Set(eventsArray.map((e) => e.asset))];
  const accounts = [...new Set(eventsArray.map((e) => e.owner))];

  const days = Math.ceil((eventsArray[length - 1].timestamp - eventsArray[0].timestamp) / 86400);

  return {
    firstTxHash,
    lastTxHash,
    assets,
    accounts,
    days,
  };
}

function createHighNumApprovalsAlert(spender, approvalsArray) {
  const {
    firstTxHash,
    lastTxHash,
    assets,
    accounts,
    days,
  } = getEventInformation(approvalsArray);
  return Finding.fromObject({
    name: 'High number of accounts granted approvals for digital assets',
    description: `${spender} obtained transfer approval for ${assets.length} assets by ${accounts.length} accounts over period of ${days} days.`,
    alertId: 'ICE-PHISHING-HIGH-NUM-APPROVALS',
    severity: FindingSeverity.Low,
    type: FindingType.Suspicious,
    metadata: {
      firstTxHash,
      lastTxHash,
      assetsImpacted: assets,
    },
  });
}

function createHighNumTransfersAlert(spender, transfersArray) {
  const {
    firstTxHash,
    lastTxHash,
    assets,
    accounts,
    days,
  } = getEventInformation(transfersArray);
  return Finding.fromObject({
    name: 'Previously approved assets transferred',
    description: `${spender} transferred ${assets.length} assets from ${accounts.length} accounts over period of ${days} days.`,
    alertId: 'ICE-PHISHING-HIGH-NUM-APPROVED-TRANSFERS',
    severity: FindingSeverity.High,
    type: FindingType.Exploit,
    metadata: {
      firstTxHash,
      lastTxHash,
      assetsImpacted: assets,
    },
  });
}

function createApprovalForAllAlert(spender, owner, asset) {
  return Finding.fromObject({
    name: 'Account got approval for all tokens',
    description: `${spender} obtained transfer approval for all tokens from ${owner}`,
    alertId: 'ICE-PHISHING-APPROVAL-FOR-ALL',
    severity: FindingSeverity.Low,
    type: FindingType.Suspicious,
    metadata: {
      spender,
      owner,
      asset,
    },
  });
}

// Checks if an address is EOA and caches the result
async function checkIfEoa(address, cachedAddresses) {
  if (cachedAddresses.has(address)) {
    const { isEoa } = cachedAddresses.get(address);
    return isEoa;
  }

  const code = await getEthersProvider().getCode(address);
  const isEoa = (code === '0x');
  cachedAddresses.set(address, { isEoa });
  return isEoa;
}

// Check if the address has high number of transactions
async function hasHighNonce(address, blockNumber, cachedAddresses, threshold) {
  // Should never happen
  if (!cachedAddresses.has(address)) return false;

  // Don't update the nonce if it is already higher than the threshold
  const cachedData = cachedAddresses.get(address);
  if (cachedData?.nonce > threshold) return true;

  // Update the cached nonce
  const newNonce = await getEthersProvider().getTransactionCount(address, blockNumber);
  cachedData.nonce = newNonce;
  cachedAddresses.set(address, cachedData);

  return (cachedData.nonce > threshold);
}

module.exports = {
  createHighNumApprovalsAlert,
  createHighNumTransfersAlert,
  createApprovalForAllAlert,
  checkIfEoa,
  hasHighNonce,
};
