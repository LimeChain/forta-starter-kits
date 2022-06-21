const { Finding, FindingSeverity, FindingType } = require('forta-agent');
const { default: axios } = require('axios');

const flashbotsUrl = 'https://blocks.flashbots.net/v1/blocks?limit=5';
let lastBlockNumber = 0;

const handleBlock = async () => {
  const findings = [];

  let result;
  try {
    result = await axios.get(flashbotsUrl);
  } catch (e) {
    console.log('Error:', e.code);
    return [];
  }

  const { blocks } = result.data;

  blocks.forEach((block) => {
    const { transactions, block_number: blockNumber } = block;

    // Only process blocks that aren't processed
    if (blockNumber > lastBlockNumber) {
      transactions.forEach((transaction) => {
        const {
          eoa_address: from,
          to_address: to,
          transaction_hash: hash,
        } = transaction;

        findings.push(Finding.fromObject({
          name: 'Flashbot transaction',
          description: `${from} interacted with ${to} in a flashbot transaction`,
          alertId: 'FLASHBOT-TRANSACTION',
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            from,
            to,
            hash,
          },
        }));
      });
      lastBlockNumber = blockNumber;
    }
  });

  return findings;
};

module.exports = {
  handleBlock,
  resetLastBlockNumber: () => { lastBlockNumber = 0; }, // Exported for unit tests
};
