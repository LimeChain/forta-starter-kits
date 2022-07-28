const { ethers } = require('forta-agent');
const LRU = require('lru-cache');

const {
  createHighNumApprovalsAlert,
  createHighNumTransfersAlert,
  createApprovalForAllAlert,
  checkIfEoa,
  hasHighNonce,
} = require('./helper');
const { threshold, timePeriodDays } = require('../bot-config.json');

const NONCE_THRESHOLD = 100;
const ONE_DAY = 24 * 60 * 60;
const TIME_PERIOD = timePeriodDays * ONE_DAY;
const ADDRESS_ZERO = ethers.constants.AddressZero;

const approvalEventSigErc20 = 'event Approval(address indexed owner, address indexed spender, uint256 value)';
const approvalEventSigErc721 = 'event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId)';
const approvalForAllEventSig = 'event ApprovalForAll(address indexed owner, address indexed spender, bool approved)';

const transferEventSigErc20 = 'event Transfer(address indexed from, address indexed to, uint256 value)';
const transferEventSigErc721 = 'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)';

const erc1155transferEventSigs = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 tokenId, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] tokenIds, uint256[] values)',
];

const approvals = {};
const transfers = {};

// Every address is ~100B
// 100_000 addresses are 10MB
const cachedAddresses = new LRU({ max: 100_000 });

const handleTransaction = async (txEvent) => {
  const findings = [];

  const {
    hash,
    timestamp,
    blockNumber,
    from: f,
  } = txEvent;
  const txFrom = ethers.utils.getAddress(f);

  // ERC20 and ERC721 approvals and transfers have the same signature
  // so we need to collect them seperately
  const approvalEvents = [
    ...txEvent.filterLog(approvalEventSigErc20),
    ...txEvent.filterLog(approvalEventSigErc721),
    ...txEvent.filterLog(approvalForAllEventSig),
  ];

  const transferEvents = [
    ...txEvent.filterLog(transferEventSigErc20),
    ...txEvent.filterLog(transferEventSigErc721),
    ...txEvent.filterLog(erc1155transferEventSigs),
  ];

  // Don't process transfer events if there are no approvals
  // Both ERC20 and ERC721 emit Approve on transferFrom
  if (approvalEvents.length === 0) return findings;

  await Promise.all(approvalEvents.map(async (event) => {
    const { address: asset, name } = event;
    const {
      owner,
      spender,
      value,
      tokenId,
      approved,
    } = event.args;

    const isApprovalForAll = (name === 'ApprovalForAll');

    // Filter out approval revokes
    if (isApprovalForAll && !approved) return;
    if (value?.eq(0)) return;
    if (spender === ADDRESS_ZERO) return;

    // When transfering ERC20 tokens an Approval event is emitted with lower value
    // We should ignore these Approval events because they are duplicates
    const isAlreadyApproved = (tokenId)
      ? false
      : approvals[spender]?.some((a) => a.owner === owner);

    if (isAlreadyApproved) return;

    // Skip if the owner or the spender is not EOA
    const isOwnerEoa = await checkIfEoa(owner, cachedAddresses);
    if (!isOwnerEoa) return;

    const isSpenderEoa = await checkIfEoa(spender, cachedAddresses);
    if (!isSpenderEoa) return;

    // If the spender has high nonce it is probably a CEX
    const highNonce = await hasHighNonce(spender, blockNumber, cachedAddresses, NONCE_THRESHOLD);
    if (highNonce) return;

    // Initialize the approvals array for the spender if it doesn't exist
    if (!approvals[spender]) approvals[spender] = [];

    // Update the approvals for the spender
    approvals[spender].push({
      asset,
      owner,
      hash,
      timestamp,
      tokenId,
      isApprovalForAll,
    });

    // Filter out old approvals
    approvals[spender] = approvals[spender].filter((a) => timestamp - a.timestamp < TIME_PERIOD);

    if (approvals[spender].length > threshold) {
      findings.push(createHighNumApprovalsAlert(spender, approvals[spender]));
    }

    if (isApprovalForAll) {
      findings.push(createApprovalForAllAlert(spender, owner, asset));
    }
  }));

  transferEvents.forEach((event) => {
    const asset = event.address;
    const {
      from,
      tokenId,
      tokenIds,
    } = event.args;

    // Filter out direct transfers and mints
    if (from === txFrom || from === ADDRESS_ZERO) return;

    // Check if we monitor the spender
    const spenderApprovals = approvals[txFrom];
    if (!spenderApprovals) return;

    // Check if we have caught the approval
    // For ERC20: Check if there is an approval from the owner that isn't from the current tx
    // For ERC721: Check if the tokenId is approved or if there is an ApprovalForAll
    const hasMonitoredApproval = (tokenId)
      ? spenderApprovals.filter((a) => a.owner === from)
        .some((a) => a.isApprovalForAll || a.tokenId.eq(tokenId) || tokenIds?.includes(a.tokenId))
      : spenderApprovals.find((a) => a.owner === from)?.timestamp < timestamp;

    if (!hasMonitoredApproval) return;

    // Initialize the transfers array for the spender if it doesn't exist
    if (!transfers[txFrom]) transfers[txFrom] = [];

    // Update the transfers for the spender
    transfers[txFrom].push({
      asset,
      owner: from,
      hash,
      timestamp,
    });

    // Filter out old transfers
    transfers[txFrom] = transfers[txFrom].filter((a) => timestamp - a.timestamp < TIME_PERIOD);

    if (transfers[txFrom].length > threshold) {
      findings.push(createHighNumTransfersAlert(txFrom, transfers[txFrom]));
    }
  });

  return findings;
};

let lastTimestamp = 0;

const handleBlock = async (blockEvent) => {
  const { timestamp } = blockEvent.block;

  console.log('Cleaning');
  console.log(`Approvals before: ${Object.keys(approvals).length}`);
  console.log(`Transfers before: ${Object.keys(transfers).length}`);

  // Clean the data every timePeriodDays
  if (timestamp - lastTimestamp > TIME_PERIOD) {
    Object.entries(approvals).forEach(([spender, data]) => {
      const { length } = data;
      // Clear the approvals if the last approval for a spender is more than timePeriodDays ago
      if (timestamp - data[length - 1].timestamp > TIME_PERIOD) {
        delete approvals[spender];
      }
    });

    Object.entries(transfers).forEach(([spender, data]) => {
      const { length } = data;
      // Clear the transfers if the last transfer from a spender is more than timePeriodDays ago
      if (timestamp - data[length - 1].timestamp > TIME_PERIOD) {
        delete transfers[spender];
      }
    });

    console.log(`Approvals after: ${Object.keys(approvals).length}`);
    console.log(`Transfers after: ${Object.keys(transfers).length}`);

    lastTimestamp = timestamp;
  }
  return [];
};

module.exports = {
  handleTransaction,
  handleBlock,
  getApprovals: () => approvals, // Exported for unit tests
  getTransfers: () => transfers, // Exported for unit tests
  resetLastTimestamp: () => { lastTimestamp = 0; },
};
