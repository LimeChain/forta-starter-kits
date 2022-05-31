const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} = require("forta-agent");
const {
  threshholdOfAditionalVotingPowerAccumulated,
  threshholdOfAditionalVotingPowerDistributed,
  accumulationMonitoringPeriod,
  distributionMonitoringPeriod,
  eventSigs,
  contractAbi,
  protocolAddress,
  tokenDefaultABI,
  maxTracked,
} = require("./agent.config");

const addressTracker = {};

let provider;
let tokenContract;
let tokenAddress;
let protocolContract;
let tokenDecimals = 0;
let totalInCirculation = 1000;
let startTimestamp = 0;
let distributionTracking = false;
let isRunningJob = false;
let localFindings = [];
const updateAddress = (from, to, valueNormalized, addressTracker) => {
  const objectKeys = Object.keys(addressTracker);
  if (objectKeys.length > maxTracked) {
    delete addressTracker[objectKeys[0]];
  }
  if (!addressTracker[from]) {
    addressTracker[from] = {
      initialBalance: 0,
      newBalance: valueNormalized * -1,
      powerGainInPercentage: (valueNormalized / totalInCirculation) * 100,
      recentTransfer: false,
      hasVoted: false,
      tokensAccumulated: 0,
    };
  } else {
    const addressTracked = addressTracker[from];
    addressTracked.initialBalance = addressTracked.newBalance;
    addressTracked.newBalance = addressTracked.initialBalance - valueNormalized;
    addressTracked.recentTransfer =
      addressTracked.powerGainInPercentage >
      threshholdOfAditionalVotingPowerAccumulated
        ? true
        : false;
    addressTracked.powerGainInPercentage =
      (addressTracked.newBalance / totalInCirculation) * 100;
    addressTracker[from] = addressTracked;
  }
  if (!addressTracker[to]) {
    addressTracker[to] = {
      initialBalance: valueNormalized,
      newBalance: valueNormalized,
      powerGainInPercentage: (valueNormalized / totalInCirculation) * 100,
      recentTransfer: false,
      hasVoted: false,
      tokensAccumulated: 0,
    };
  } else {
    const addressTracked = addressTracker[to];
    addressTracked.initialBalance = addressTracked.newBalance;
    addressTracked.newBalance = addressTracked.initialBalance + valueNormalized;
    addressTracked.powerGainInPercentage =
      (addressTracked.newBalance / totalInCirculation) * 100;
    addressTracked.tokensAccumulated =
      addressTracked.powerGainInPercentage >
      threshholdOfAditionalVotingPowerAccumulated
        ? addressTracked.newBalance
        : 0;
    addressTracked.recentTransfer = false;
    addressTracker[to] = addressTracked;
  }
};

//Load all addresses from the last 10k blocks for specific token
const provideInitialize = (addressTracker) => {
  return async () => {
    provider = await getEthersProvider();
    protocolContract = new ethers.Contract(
      protocolAddress,
      contractAbi,
      provider
    );
    startTimestamp = await (await provider.getBlock()).timestamp;
    tokenAddress = await protocolContract.token();

    tokenContract = new ethers.Contract(
      tokenAddress,
      tokenDefaultABI,
      provider
    );
    tokenDecimals = await tokenContract.decimals();
    totalInCirculation = await tokenContract.totalSupply();
    totalInCirculation = ethers.utils.formatUnits(
      totalInCirculation,
      tokenDecimals
    );

    const filter = tokenContract.filters.Transfer();
    const currentBlock = await provider.getBlockNumber();
    filter.fromBlock = currentBlock - 10000;
    const eventLogsFromLast10KBlocks = await provider.getLogs(filter);
    const tokenIFace = new ethers.utils.Interface(tokenDefaultABI);
    for (let event of eventLogsFromLast10KBlocks) {
      const res = tokenIFace.parseLog(event);
      const { from, to, value } = res.args;
      const valueNormalized = Number(
        ethers.utils.formatUnits(value, tokenDecimals)
      );
      updateAddress(from, to, valueNormalized, addressTracker);
    }
  };
};

const provideHandleTransaction = (addressTracker) => {
  return async (txEvent) => {
    const findings = [];

    const transferEvents = txEvent.filterLog(tokenDefaultABI[0], tokenAddress);

    for (let event of transferEvents) {
      const { from, to, value } = event.args;
      const valueNormalized = Number(
        ethers.utils.formatUnits(value, tokenDecimals)
      );
      updateAddress(from, to, valueNormalized, addressTracker);
    }

    const voteEvents = txEvent.filterLog(eventSigs, protocolAddress);

    for (let event of voteEvents) {
      const proposalID = Object.values(event.args)[0];

      let voter = "";
      for (let item of Object.values(event.args)) {
        if (ethers.utils.isAddress(item)) {
          voter = item;
        }
      }
      if (addressTracker[voter]) {
        addressTracker[voter].hasVoted = true;
        addressTracker[voter].proposalID = proposalID;
      }
    }

    return findings;
  };
};

const provideHandleBlock = (addressTracker) => {
  return async (blockEvent) => {
    let findings = [];

    if (
      (blockEvent.block.timestamp - startTimestamp >
        accumulationMonitoringPeriod &&
        !isRunningJob) ||
      distributionTracking
    ) {
      runJob(blockEvent, addressTracker);
      isRunningJob = true;
    }

    if (localFindings.length > 0) {
      findings = localFindings;
      localFindings = [];
    }

    return findings;
  };
};
const runJob = (blockEvent, addressTracker) => {
  for (let key of Object.keys(addressTracker)) {
    const addressTracked = addressTracker[key];

    if (!distributionTracking) {
      if (
        addressTracked.powerGainInPercentage >
          threshholdOfAditionalVotingPowerAccumulated &&
        !addressTracked.hasVoted
      ) {
        localFindings.push(
          Finding.fromObject({
            name: "Significant accumulation of voting power",
            description: `${key} accumulating ${addressTracked.powerGainInPercentage}% of voting power `,
            alertId: "SIGNIFICANT-VOTING-POWER-ACCUMULATION",
            severity: FindingSeverity.Low,
            type: FindingType.Suspicious,
            metadata: {},
          })
        );
        distributionTracking = true;
      } else if (
        addressTracked.powerGainInPercentage >
          threshholdOfAditionalVotingPowerAccumulated &&
        addressTracked.hasVoted
      ) {
        localFindings.push(
          Finding.fromObject({
            name: "Significant accumulation of voting power voted",
            description: `${key} accumulating ${addressTracked.powerGainInPercentage}% of voting power and voted on proposal ${addressTracked.proposalID} `,
            alertId: "SIGNIFICANT-VOTING-POWER-ACCUMULATION-VOTE",
            severity: FindingSeverity.Medium,
            type: FindingType.Suspicious,
            metadata: {},
          })
        );
        addressTracked.hasVoted = false;
        addressTracked.proposalID = null;
        distributionTracking = true;
      }
      startTimestamp = blockEvent.block.timestamp;
    } else {
      if (
        blockEvent.block.timestamp - startTimestamp >
        distributionMonitoringPeriod
      ) {
        if (addressTracked.recentTransfer && !addressTracked.hasVoted) {
          const tokensDistributedPercentage =
            (addressTracked.newBalance / addressTracked.tokensAccumulated) *
            100;
          if (
            tokensDistributedPercentage >
            threshholdOfAditionalVotingPowerDistributed
          ) {
            localFindings.push(
              Finding.fromObject({
                name: "Significant accumulation/distribution of voting power",
                description: `${key} accumulated and then distributed ${
                  100 - tokensDistributedPercentage
                }% of voting power possibly indicating a govt attack  `,
                alertId: "SIGNIFICANT-VOTING-POWER-ACCUMULATION-DISTRIBUTION",
                severity: FindingSeverity.Medium,
                type: FindingType.Suspicious,
                metadata: {},
              })
            );
          }
          addressTracked.recentTransfer = false;
        } else if (addressTracked.recentTransfer && addressTracked.hasVoted) {
          const tokensDistributedPercentage =
            (addressTracked.newBalance / addressTracked.tokensAccumulated) *
            100;
          if (
            tokensDistributedPercentage >
            threshholdOfAditionalVotingPowerDistributed
          ) {
            localFindings.push(
              Finding.fromObject({
                name: "Significant accumulation/distribution of voting power voted",
                description: `${key} accumulated and then distributed ${
                  100 - tokensDistributedPercentage
                }% of voting power and voted on proposal ${
                  addressTracked.proposalID
                } possibly indicating a govt attack  `,
                alertId:
                  "SIGNIFICANT-VOTING-POWER-ACCUMULATION-DISTRIBUTION-VOTE",
                severity: FindingSeverity.Medium,
                type: FindingType.Suspicious,
                metadata: {},
              })
            );
          }
          addressTracked.recentTransfer = false;
          addressTracked.hasVoted = false;
          addressTracked.proposalID = null;
        }
      }
    }
  }
};

module.exports = {
  initialize: provideInitialize(addressTracker),
  handleTransaction: provideHandleTransaction(addressTracker),
  handleBlock: provideHandleBlock(addressTracker),
  provideHandleTransaction,
  provideHandleBlock,
  resetDistributionTracker: () => (distributionTracking = false),
  resetIsRunningJob: () => (isRunningJob = false),
  resetTimestamp: () => (startTimestamp = 0),
};
