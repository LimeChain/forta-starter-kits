const {
  FindingType,
  FindingSeverity,
  Finding,
  getEthersProvider,
} = require('forta-agent');
const axios = require('axios');
const {
  handleBlock,
  resetLastBlockNumber,
} = require('./agent');

const from1 = '0xfrom1';
const to1 = '0xto1';
const from2 = '0xfrom2';
const to2 = '0xto2';
const from3 = '0xfrom3';
const to3 = '0xto3';

const block1 = {
  block_number: 1,
  transactions: [
    {
      eoa_address: from1,
      to_address: to1,
      transaction_hash: '0x1',
    },
  ],
};

const block2 = {
  block_number: 2,
  transactions: [
    {
      eoa_address: from2,
      to_address: to2,
      transaction_hash: '0x2',
    },
    {
      eoa_address: from3,
      to_address: to3,
      transaction_hash: '0x3',
    },
  ],
};

jest.mock('axios');

// Mock the balanceOf method
jest.mock('forta-agent', () => {
  const original = jest.requireActual('forta-agent');
  return {
    ...original,
    getEthersProvider: jest.fn(),
  };
});

const mockGetTransactionReceipt = jest.fn();
getEthersProvider.mockImplementation(() => ({
  getTransactionReceipt: mockGetTransactionReceipt,
}));

describe('flashbot attack bot', () => {
  describe('handleBlock', () => {
    beforeEach(() => {
      mockGetTransactionReceipt.mockReset();
      resetLastBlockNumber();
    });

    it('should return empty findings if there are no new flashbot blocks', async () => {
      // Flashbots API always returns the last X blocks
      // We process block1 and check if we will process it again
      const response = { data: { blocks: [block1] } };
      const logs = [];

      axios.get.mockResolvedValueOnce(response);
      mockGetTransactionReceipt.mockResolvedValueOnce({ logs });
      await handleBlock();

      axios.get.mockResolvedValueOnce(response);
      const findings = await handleBlock();

      expect(findings).toStrictEqual([]);
      expect(mockGetTransactionReceipt).toHaveBeenCalledTimes(1);
    });

    it('should not crash if the API call returns an error', async () => {
      const error = { code: 'some error' };
      const logs = [];
      const response = { data: { blocks: [block1] } };

      axios.get.mockRejectedValueOnce(error);
      await handleBlock();

      axios.get.mockResolvedValueOnce(response);
      mockGetTransactionReceipt.mockResolvedValueOnce({ logs });
      const findings = await handleBlock();

      expect(findings).toStrictEqual([Finding.fromObject({
        name: 'Flashbot transaction',
        description: `${from1} interacted with ${to1} in a flashbot transaction`,
        alertId: 'FLASHBOT-TRANSACTION',
        severity: FindingSeverity.Low,
        type: FindingType.Info,
        metadata: {
          from: from1,
          to: to1,
          hash: '0x1',
        },
      })]);
      expect(mockGetTransactionReceipt).toHaveBeenCalledTimes(1);
    });

    it('should return findings if there are new flashbot blocks', async () => {
      const response1 = { data: { blocks: [block1] } };
      const logs1 = [];
      mockGetTransactionReceipt.mockResolvedValueOnce({ logs: logs1 });
      axios.get.mockResolvedValueOnce(response1);
      await handleBlock();

      // Only block2 should be processed
      const response2 = { data: { blocks: [block1, block2] } };
      const logs2 = [{ address: to2 }];
      const logs3 = [{ address: to3 }];
      mockGetTransactionReceipt.mockResolvedValueOnce({ logs: logs2 });
      mockGetTransactionReceipt.mockResolvedValueOnce({ logs: logs3 });
      axios.get.mockResolvedValueOnce(response2);
      const findings = await handleBlock();

      expect(findings).toStrictEqual([Finding.fromObject({
        name: 'Flashbot transaction',
        description: `${from2} interacted with ${to2} in a flashbot transaction`,
        alertId: 'FLASHBOT-TRANSACTION',
        severity: FindingSeverity.Low,
        type: FindingType.Info,
        addresses: [to2],
        metadata: {
          from: from2,
          to: to2,
          hash: '0x2',
        },
      }), Finding.fromObject({
        name: 'Flashbot transaction',
        description: `${from3} interacted with ${to3} in a flashbot transaction`,
        alertId: 'FLASHBOT-TRANSACTION',
        severity: FindingSeverity.Low,
        type: FindingType.Info,
        addresses: [to3],
        metadata: {
          from: from3,
          to: to3,
          hash: '0x3',
        },
      })]);
      expect(mockGetTransactionReceipt).toHaveBeenCalledTimes(3);
    });
  });
});
