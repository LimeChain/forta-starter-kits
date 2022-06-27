const {
  Finding,
  FindingSeverity,
  FindingType,
  getEthersProvider,
} = require('forta-agent');
const { default: axios } = require('axios');

const flashbotsUrl = 'https://blocks.flashbots.net/v1/blocks?limit=10';
let lastBlockNumber = 0;

const handleBlock = async () => {
  let result;
  try {
    result = await axios.get(flashbotsUrl);
  } catch (e) {
    console.log('Error:', e.code);
    return [];
  }

  const { blocks } = result.data;

  // Get findings for every new flashbot block and combine them
  let findings = await Promise.all(blocks.map(async (block) => {
    const { transactions, block_number: blockNumber } = block;
    let currentBlockFindings;

    // Only process blocks that aren't processed
    if (blockNumber > lastBlockNumber) {
      // Create finding for every flashbot transaction in the block
      currentBlockFindings = await Promise.all(transactions.map(async (transaction) => {
        const {
          eoa_address: from,
          to_address: to,
          transaction_hash: hash,
        } = transaction;

        // Use the tx logs to get the impacted contracts
        const { logs } = await getEthersProvider().getTransactionReceipt(hash);
        let addresses = logs.map((log) => log.address.toLowerCase());
        addresses = [...new Set(addresses)];

        return Finding.fromObject({
          name: 'Flashbot transaction',
          description: `${from} interacted with ${to} in a flashbot transaction`,
          alertId: 'FLASHBOT-TRANSACTION',
          severity: FindingSeverity.Low,
          type: FindingType.Info,
          addresses,
          metadata: {
            from,
            to,
            hash,
          },
        });
      }));

      lastBlockNumber = blockNumber;
    }

    return currentBlockFindings;
  }));

  findings = findings.flat().filter((f) => !!f);
  return findings;
};

module.exports = {
  handleBlock,
  resetLastBlockNumber: () => { lastBlockNumber = 0; }, // Exported for unit tests
};
