const {
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
} = require("forta-agent");
const {
  getContractsByChainId,
  getInitialFundedByTornadoCash,
  eventABI,
  addressLimit,
} = require("./helper");

const ethersProvider = getEthersProvider();

let tornadoCashAddresses;

//Adding one placeholder address for testing purposes
let fundedByTornadoCash = new Set([
  "0x58f970044273705ab3b0e87828e71123a7f95c9d",
]);

//Load all properties by chainId
const initialize = async () => {
  const { chainId } = await ethersProvider.getNetwork();
  tornadoCashAddresses = await getContractsByChainId(chainId);
  fundedByTornadoCash = await getInitialFundedByTornadoCash(chainId);
};

function provideHandleTranscation(ethersProvider) {
  return async function handleTransaction(txEvent) {
    const findings = [];
    const filteredForFunded = txEvent.filterLog(eventABI, tornadoCashAddresses);

    filteredForFunded.forEach((tx) => {
      const { to } = tx.args;

      if (fundedByTornadoCash.size >= addressLimit) {
        const tempFundedByTornadoCashArray = [...fundedByTornadoCash];
        tempFundedByTornadoCashArray.shift();
        fundedByTornadoCash = new Set(tempFundedByTornadoCashArray);
      }

      fundedByTornadoCash.add(to.toLowerCase());
    });

    const hasInteractedWith = fundedByTornadoCash.has(txEvent.from);
    if (hasInteractedWith) {
      const contractCode = await ethersProvider.getCode(txEvent.to);

      if (contractCode != "0x") {
        findings.push(
          Finding.fromObject({
            name: "Tornado Cash funded account interacted with contract",
            description: `${txEvent.from} interacted with contract ${txEvent.to}`,
            alertId: "TORNADO-CASH-FUNDED-ACCOUNT-INTERACTION",
            severity: FindingSeverity.Low,
            type: FindingType.Suspicious,
          })
        );
      }
    }
    return findings;
  };
}

module.exports = {
  initialize,
  handleTransaction: provideHandleTranscation(ethersProvider),
  provideHandleTranscation,
};
