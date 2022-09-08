const {
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
} = require('forta-agent');
const { default: axios } = require('axios');

const { nonceThreshold, etherscanApis } = require('../bot-config.json');
const AddressType = require('./address-type');

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

function getEtherscanUrl(address, chainId) {
  const { url, key } = etherscanApis[chainId];
  return `${url}&address=${address}&apikey=${key}`;
}

async function getEoaType(address, blockNumber) {
  const nonce = await getEthersProvider().getTransactionCount(address, blockNumber);
  return (nonce > nonceThreshold)
    ? AddressType.EoaWithHighNonce
    : AddressType.EoaWithLowNonce;
}

async function getContractType(address, chainId) {
  const result = await axios.get(getEtherscanUrl(address, chainId));

  if (result.data.message === 'NOTOK') {
    console.log(`rate limit reached; skipping check for ${address}`);
    return null;
  }

  const isVerified = (result.data.status === '1');

  return (isVerified)
    ? AddressType.VerifiedContract
    : AddressType.UnverifiedContract;
}

async function getAddressType(address, cachedAddresses, blockNumber, chainId, isOwner) {
  if (cachedAddresses.has(address)) {
    const type = cachedAddresses.get(address);

    // Don't update the cached address if
    // the check is for the owner
    // the type cannot be changed back
    // the address is ignored
    if (
      isOwner
      || type === AddressType.EoaWithHighNonce
      || type === AddressType.VerifiedContract
      || type.startsWith('Ignored')
    ) {
      return type;
    }

    const getTypeFn = (type === AddressType.EoaWithLowNonce)
      ? async () => getEoaType(address, blockNumber)
      : async () => getContractType(address, chainId);
    const newType = await getTypeFn(address, blockNumber);

    if (newType && newType !== type) cachedAddresses.set(address, newType);
    return newType;
  }

  // If the address is not in the cache check if it is a contract
  const code = await getEthersProvider().getCode(address);
  const isEoa = (code === '0x');

  // Skip etherscan call and directly return unverified if checking for the owner
  if (isOwner && !isEoa) return AddressType.UnverifiedContract;

  const getTypeFn = (isEoa)
    ? async () => getEoaType(address, blockNumber)
    : async () => getContractType(address, chainId);
  const type = await getTypeFn(address, blockNumber);

  if (type) cachedAddresses.set(address, type);
  return type;
}

module.exports = {
  createHighNumApprovalsAlert,
  createHighNumTransfersAlert,
  createApprovalForAllAlert,
  getAddressType,
};
