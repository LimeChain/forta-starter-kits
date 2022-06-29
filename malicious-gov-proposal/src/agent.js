const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
} = require("forta-agent");
const { address, type, parameters } = require("../bot-config.json");

const COMP_EVENT_SIG =
  "event ProposalCreated(uint id, address proposer, address[] targets, uint[] values, string[] signatures, bytes[] calldatas, uint startBlock, uint endBlock, string description)";
const AAVE_EVENT_SIG =
  "event ProposalCreated(uint256 id, address indexed creator, address indexed executor, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, bool[] withDelegatecalls, uint256 startBlock, uint256 endBlock, address strategy, bytes32 ipfsHash)";
const ARAGON_EVENT_SIG =
  "event StartVote(uint256 indexed voteId, address indexed creator, string metadata)";

let eventSig;
let processFunc;
let params;

function processSignatures(event) {
  const { signatures, calldatas } = event.args;
  let finding = false;

  signatures.forEach((sig, i) => {
    // Match the function name with a provided signature
    const funcName = sig.split("(")[0];
    const param = params.find((p) => p.signature.split("(")[0] === funcName);
    if (!param) return;

    // Get the function arguments and decode the data
    const functionArgs = param.signature
      .split("(")[1]
      .split(")")[0]
      .split(", ");
    const decoded = ethers.utils.defaultAbiCoder.decode(
      functionArgs,
      calldatas[i]
    );

    // Check if there is a parameter that is outside the range
    param.thresholds.forEach((threshold) => {
      const { name, min, max, decimals } = threshold;

      const decodedValue = decimals
        ? +ethers.utils.formatUnits(decoded[name], decimals)
        : decoded[name];

      if (!decodedValue) return;
      console.log("Decoded value:", decodedValue);
      console.log("Min:", min);
      console.log("Max:", max);
      if (decodedValue < min || decodedValue > max) {
        finding = true;
      }
    });
  });

  return finding;
}

function processAragonVote(event) {
  const { metadata } = event.args;
  let finding = false;

  // Process the metadata: remove the prefix, convert it to lower case and split it to changes
  const processedMetadata = metadata.split("Omnibus vote: ")[1].toLowerCase();
  const changes = processedMetadata.split(";");

  // Compare each change with every provided param
  changes.forEach((message) => {
    params.forEach((param) => {
      const { string, min, max } = param;

      // Get the param string and process it
      // replace '*' with wildcard capture group and '_' with wildcard
      const processedString = string
        .toLowerCase()
        .replace("*", "(.+)")
        .replace("_", ".+");

      // Test the metadata
      const regex = new RegExp(processedString);
      const match = message.match(regex);
      if (!match) return;

      // Convert the match to a number
      // Remove the commas: (1,000 => 1000)
      const number = match[1].replace(/,/g, "");

      if (number < min || number > max) {
        finding = true;
      }
    });
  });
  return finding;
}

function provideInitialize(configType, configParams) {
  params = configParams;
  return () => {
    switch (configType) {
      case "comp":
        eventSig = COMP_EVENT_SIG;
        processFunc = processSignatures;
        break;
      case "aave":
        eventSig = AAVE_EVENT_SIG;
        processFunc = processSignatures;
        break;
      case "aragon":
        eventSig = ARAGON_EVENT_SIG;
        processFunc = processAragonVote;
        break;
      default:
        throw new Error("Invalid type");
    }
  };
}

const handleTransaction = async (txEvent) => {
  const findings = [];

  const events = txEvent.filterLog(eventSig, address);

  events.forEach((event) => {
    const isMalicious = processFunc(event);

    if (isMalicious) {
      findings.push(
        Finding.fromObject({
          name: "Possible malicious governance proposal created",
          description: `${txEvent.from} created a possible malicious governance proposal`,
          alertId: "POSSIBLE-MALICIOUS-GOVT-PROPOSAL-CREATED",
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
        })
      );
    }
  });

  return findings;
};

module.exports = {
  provideInitialize,
  initialize: provideInitialize(type, parameters),
  handleTransaction,
};
