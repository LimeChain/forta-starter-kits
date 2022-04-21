const { Finding, FindingSeverity, FindingType } = require("forta-agent");
const { timeFrameBlocks } = require("./helper");
const axios = require("axios");

const tornadoCashAddresses = [
  "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", // 0.1 ETH
  "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936", // 1 ETH
  "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf", // 10 ETH
  "0xA160cdAB225685dA1d56aa342Ad8841c3b53f291", // 100 ETH
];

//YOUR ETHERSCAN API KEY
const apikey = "test";
const fundedByTornadoCash = new Set();

const handleTransaction = async (txEvent) => {
  const findings = [];

  await getAllFundedFromTornadoCash(txEvent);
  const fundedByInteractedWithContract =
    await getAllInteractedWithContractFundedFromTornadoChain(txEvent);

  if (fundedByInteractedWithContract.length > 0) {
    fundedByInteractedWithContract.forEach((tx) => {
      findings.push(
        Finding.fromObject({
          name: "Tornado Cash funded account interacted with contract",
          description: `${tx.from} interacted with contract ${tx.contractAddress}`,
          alertId: "TORNADO-CASH-FUNDED-ACCOUNT-INTERACTION",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
        })
      );
    });
  }
  return findings;
};

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

const getAllInteractedWithContractFundedFromTornadoChain = async (txHash) => {
  const query = await generateEthScanQuery(txHash);
  const response = await axios.default.get(query);
  const allFundedAddressesAsArray = [...fundedByTornadoCash];

  const filteredForInteractions = response.data.result.filter(
    (tx) =>
      allFundedAddressesAsArray.includes(tx.from) && tx.contractAddress != ""
  );

  return filteredForInteractions;
};

const generateEthScanInternalQuery = async (txHash) => {
  const startBlock = txHash.blockNumber - timeFrameBlocks;
  return `https://api.etherscan.io/api?module=account&action=txlistinternal&address=${txHash.from}&startblock=${startBlock}&endblock=${txHash.blockNumber}&page=1&offset=1000&sort=desc&apikey=${apikey}`;
};

const generateEthScanQuery = async (txHash) => {
  const startBlock = txHash.blockNumber - timeFrameBlocks;
  return `https://api.etherscan.io/api?module=account&action=txlist&address=${txHash.from}&startblock=${startBlock}&endblock=latest&page=1&offset=1000&sort=desc&apikey=${apikey}`;
};

module.exports = {
  handleTransaction,
};
