const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
} = require("forta-agent");
const {
  accountThreshold,
  preExecutionThreshold,
  maxTracked,
} = require("./agent.config");

const { protocolName, bots } = require("./bot-config.json");
const { BigNumber } = require("ethers");
const { isBigNumberish } = require("@ethersproject/bignumber/lib/bignumber");
const proposalTracker = {};

let protocolAddress;
let minAcceptQuorumPct = 0;
let pctBase = 0;
let proposalEvents = [];
let eventNames = [];

const provideInitialize = () => {
  return async () => {
    const contracts = Object.entries(bots[0].contracts);
    protocolAddress = contracts[0][1].address;

    proposalEvents = contracts[0][1].eventABIs;

    const eventNamesLocal = proposalEvents.map((event) => {
      let eventName = event.split(" ")[1];
      eventName = eventName.split("(")[0];
      return eventName;
    });

    for (let eventName of eventNamesLocal) {
      eventNames.push(eventName);
    }

    minAcceptQuorumPct = ethers.BigNumber.from(
      contracts[0][1].minAcceptanceQuorumPCT
    );

    pctBase = ethers.BigNumber.from(contracts[0][1].PCT_BASE);
  };
};

const addProposalToTracker = (proposalID, proposalTracker, voter) => {
  const objectKeys = Object.keys(proposalTracker);
  if (objectKeys.length > maxTracked) {
    for (let key of objectKeys) {
      if (proposalTracker[key].executed == true) {
        delete proposalTracker[key];
      }
    }
  }
  if (!proposalTracker[proposalID] && voter) {
    proposalTracker[proposalID] = {
      totalVoted: 0,
      currentVotes: 0,
      currentPCT: 0,
      executed: false,
      voters: [voter],
    };
  } else {
    proposalTracker[proposalID] = {
      totalVoted: 0,
      currentVotes: 0,
      currentPCT: 0,
      executed: false,
      voters: [],
    };
  }
};

const provideHandleTransaction = (proposalTracker, eventNames) => {
  return async (txEvent) => {
    const findings = [];

    const voteEvents = txEvent.filterLog(proposalEvents, protocolAddress);

    for (let event of voteEvents) {
      const eventArgValues = Object.values(event.args);

      let index = 0;

      for (let arg of eventArgValues) {
        if (ethers.utils.isAddress(arg)) {
          index++;
          continue;
        }
        if (typeof arg == Boolean) {
          index++;
          continue;
        }
        break;
      }

      const proposalID = eventArgValues[index];

      let voter = "";
      for (let item of Object.values(event.args)) {
        if (ethers.utils.isAddress(item)) {
          voter = item;
          break;
        }
      }

      //Here we check which event we are looking at, first is when a proposal is created, the second when its voted and the third when a vote is executed

      if (event.name == eventNames[0]) {
        addProposalToTracker(proposalID, proposalTracker, voter);
      } else if (event.name == eventNames[1]) {
        if (!proposalTracker[proposalID]) {
          addProposalToTracker(proposalID, proposalTracker);
        }
        let stake = 0;
        for (let item of Object.values(event.args)) {
          if (item == proposalID || item == voter) {
            continue;
          }
          if (isBigNumberish(item)) {
            stake = item;
            break;
          }
        }

        proposalTracker[proposalID].totalVoted++;
        proposalTracker[proposalID].currentVotes = BigNumber.from(
          proposalTracker[proposalID].currentVotes
        ).add(stake);
        proposalTracker[proposalID].currentPCT = BigNumber.from(
          proposalTracker[proposalID].currentVotes
        )
          .mul(pctBase)
          .div(minAcceptQuorumPct);
        proposalTracker[proposalID].voters.push(voter);
      } else {
        if (!proposalTracker[proposalID]) {
          return;
        }
        proposalTracker[proposalID].executed = true;
      }
    }

    return findings;
  };
};

const provideHandleBlock = (proposalTracker) => {
  return async (blockEvent) => {
    let findings = [];

    for (let key of Object.keys(proposalTracker)) {
      const proposalTracked = proposalTracker[key];
      console.log("Proposal ID:", key);
      console.log("Total Voted:", proposalTracked.totalVoted);
      console.log("Account Threshold:", accountThreshold);
      console.log(
        "Should be accepted:",
        BigNumber.from(proposalTracked.currentPCT).gte(
          BigNumber.from(minAcceptQuorumPct)
        )
      );
      console.log("Is executed:", proposalTracked.executed);
      if (
        proposalTracked.totalVoted <= accountThreshold &&
        BigNumber.from(proposalTracked.currentPCT).gte(
          BigNumber.from(minAcceptQuorumPct)
        ) &&
        proposalTracked.executed
      ) {
        findings.push(
          Finding.fromObject({
            name: "Sneak Governance Proposal Approval Passed",
            description: `Governance proposal was approved with votes from only ${proposalTracked.totalVoted} accounts`,
            alertId: "SNEAK-GOVT-PROPOSAL-APPROVAL-PASSED",
            protocol: protocolName,
            severity: FindingSeverity.Low,
            type: FindingType.Suspicious,
            metadata: {
              ACCOUNTS: proposalTracked.voters,
            },
          })
        );
      } else if (
        //Here we calculate if the currentPCT is greater or equal than 95% of the quorum required to pass the vote, so that we can alert that the proposal is about to pass
        BigNumber.from(proposalTracked.currentPCT).gte(
          BigNumber.from(minAcceptQuorumPct).sub(
            BigNumber.from(minAcceptQuorumPct).div(
              BigNumber.from(preExecutionThreshold)
            )
          )
        ) &&
        BigNumber.from(proposalTracked.currentPCT).lt(
          BigNumber.from(minAcceptQuorumPct)
        ) &&
        proposalTracked.totalVoted <= accountThreshold
      ) {
        findings.push(
          Finding.fromObject({
            name: "Sneak Governance Proposal Approval About To Pass",
            description: `Governance proposal is about to pass with votes from only ${proposalTracked.totalVoted} accounts `,
            alertId: "SNEAK-GOVT-PROPOSAL-APPROVAL-ABOUT-TO-PASS",
            protocol: protocolName,
            severity: FindingSeverity.Medium,
            type: FindingType.Suspicious,
            metadata: {
              ACCOUNTS: proposalTracked.voters,
            },
          })
        );
      }
    }

    return findings;
  };
};

module.exports = {
  initialize: provideInitialize(),
  handleTransaction: provideHandleTransaction(proposalTracker, eventNames),
  handleBlock: provideHandleBlock(proposalTracker),
  provideHandleTransaction,
  provideHandleBlock,
  resetIsRunningJob: () => (isRunningJob = false),
  setMinQuorum: (value) => {
    minAcceptQuorumPct = value;
  },
  setPCTBASE: (value) => {
    pctBase = value;
  },
};
