const {
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
} = require("forta-agent");
const {
  timeFrameBlocks,
  getContractsByChainId,
  getInitialFundedByTornadoCash,
  getAPIURL,
} = require("./helper");

const axios = require("axios");
const ethersProvider = getEthersProvider();

let tornadoCashAddresses;
let api_url = "";

const apikey = "YOUR API KEY for correct Scanner for CHAIN API";

//Adding one placeholder address for testing purposes
let fundedByTornadoCash = new Set([
  "0x58f970044273705ab3b0e87828e71123a7f95c9d",
]);

//Load all properties by chainId
const initialize = async () => {
  const { chainId } = await ethersProvider.getNetwork();
  currentChainId = chainId;
  tornadoCashAddresses = await getContractsByChainId(chainId);
  fundedByTornadoCash = await getInitialFundedByTornadoCash(chainId);
  api_url = await getAPIURL(chainId);

  console.log(tornadoCashAddresses, fundedByTornadoCash, api_url);
};

function provideHandleTranscation(
  getAllFundedFromTornadoCash,
  getAllInteractedWithContractFundedFromTornadoChain
) {
  return async function handleTransaction(txEvent) {
    const findings = [];

    await getAllFundedFromTornadoCash(txEvent);
    const fundedByInteractedWithContract =
      await getAllInteractedWithContractFundedFromTornadoChain(txEvent);

    if (fundedByInteractedWithContract.length > 0) {
      fundedByInteractedWithContract.forEach((tx) => {
        if (tx.contractAddress) {
          findings.push(
            Finding.fromObject({
              name: "Tornado Cash funded account interacted with contract",
              description: `${tx.from} interacted with contract ${tx.contractAddress}`,
              alertId: "TORNADO-CASH-FUNDED-ACCOUNT-INTERACTION",
              severity: FindingSeverity.Low,
              type: FindingType.Suspicious,
            })
          );
        } else if (tx.to) {
          findings.push(
            Finding.fromObject({
              name: "Tornado Cash funded account interacted with contract",
              description: `${tx.from} interacted with contract ${tx.to}`,
              alertId: "TORNADO-CASH-FUNDED-ACCOUNT-INTERACTION",
              severity: FindingSeverity.Low,
              type: FindingType.Suspicious,
            })
          );
        }
      });
    }
    return findings;
  };
}

//Here we detect if an account was funded by TornadoCash
const getAllFundedFromTornadoCash = async (txHash) => {
  const query = await generateEthScanInternalQuery(txHash);
  const response = await axios.default.get(query);

  const filtered = response.data.result.filter((tx) =>
    tornadoCashAddresses.includes(tx.from)
  );

  filtered.forEach((tx) => {
    fundedByTornadoCash.add(tx.to);
  });
};

//Here we get if an account funded by TornadoCash interacted with a contract
const getAllInteractedWithContractFundedFromTornadoChain = async (txHash) => {
  const query = await generateEthScanQuery(txHash);
  const response = await axios.default.get(query);
  const allFundedAddressesAsArray = [...fundedByTornadoCash];

  const filteredForInteractions = response.data.result.filter(
    (tx) =>
      allFundedAddressesAsArray.includes(tx.from) &&
      tx.input != "" &&
      tx.input.length > 5
  );

  return filteredForInteractions;
};

//Generating query for internal withdraw transactions
const generateEthScanInternalQuery = async (txHash) => {
  const startBlock = txHash.blockNumber - timeFrameBlocks;
  return `https://${api_url}/api?module=account&action=txlistinternal&address=${txHash.from}&startblock=${startBlock}&endblock=${txHash.blockNumber}&page=1&offset=1000&sort=desc&apikey=${apikey}`;
};

//Generating query for contract interactions
const generateEthScanQuery = async (txHash) => {
  const startBlock = txHash.blockNumber - timeFrameBlocks;
  return `https://${api_url}/api?module=account&action=txlist&address=${txHash.from}&startblock=${startBlock}&endblock=latest&page=1&offset=1000&sort=desc&apikey=${apikey}`;
};

module.exports = {
  initialize,
  handleTransaction: provideHandleTranscation(
    getAllFundedFromTornadoCash,
    getAllInteractedWithContractFundedFromTornadoChain
  ),
  provideHandleTranscation,
};
