/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
const {
  FindingType,
  FindingSeverity,
  Finding,
  ethers,
  getEthersProvider,
} = require('forta-agent');
const axios = require('axios');

const {
  handleTransaction,
  handleBlock,
  getApprovals,
  getTransfers,
  getCachedAddresses,
  resetLastTimestamp,
} = require('./agent');

const approveCountThreshold = 2;
const transferCountThreshold = 2;
const timePeriodDays = 30;
const nonceThreshold = 100;
const maxAddressAlertsPerPeriod = 3;

const spender = ethers.Wallet.createRandom().address;
const owner1 = ethers.Wallet.createRandom().address;
const owner2 = ethers.Wallet.createRandom().address;
const owner3 = ethers.Wallet.createRandom().address;
const asset = ethers.Wallet.createRandom().address;

// Mock the config file
jest.mock('../bot-config.json', () => ({
  approveCountThreshold,
  transferCountThreshold,
  timePeriodDays,
  nonceThreshold,
  maxAddressAlertsPerPeriod,
}), { virtual: true });

// Mock axios and ethers provider
jest.mock('axios');
jest.mock('forta-agent', () => {
  const original = jest.requireActual('forta-agent');
  return {
    ...original,
    getEthersProvider: jest.fn(),
  };
});

const mockGetCode = jest.fn();
getEthersProvider.mockImplementation(() => ({
  getCode: () => '0x',
  getTransactionCount: () => 1,
}));

const mockApprovalForAllEvent = {
  address: asset,
  name: 'ApprovalForAll',
  args: {
    owner: owner1,
    spender,
    approved: true,
  },
};

const mockApprovalEvents = [
  {
    address: asset,
    name: 'Approval',
    args: {
      owner: owner1,
      spender,
      value: ethers.BigNumber.from(5),
    },
  },
  {
    address: asset,
    name: 'Approval',
    args: {
      owner: owner2,
      spender,
      value: ethers.BigNumber.from(5),
    },
  },
  {
    address: asset,
    name: 'Approval',
    args: {
      owner: owner3,
      spender,
      value: ethers.BigNumber.from(5),
    },
  },
];

const mockTransferEvents = [
  {
    address: asset,
    name: 'Transfer',
    args: {
      from: owner1,
    },
  },
  {
    address: asset,
    name: 'Transfer',
    args: {
      from: owner2,
    },
  },
  {
    address: asset,
    name: 'Transfer',
    args: {
      from: owner3,
    },
  },
];

describe('ice-phishing bot', () => {
  describe('handleTransaction', () => {
    const mockTxEvent = {
      filterLog: jest.fn(),
      hash: 'hash2',
      timestamp: 10000,
      from: spender,
    };

    beforeAll(() => {
      const axiosResponse = { data: { status: '1' } };
      axios.get.mockResolvedValue(axiosResponse);
    });

    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
      mockGetCode.mockReset();

      Object.keys(getApprovals()).forEach((s) => delete getApprovals()[s]);
      Object.keys(getTransfers()).forEach((s) => delete getTransfers()[s]);
      getCachedAddresses().clear();
    });

    it('should return empty findings if there are no Approval and Transfer events', async () => {
      mockTxEvent.filterLog
        .mockReturnValueOnce([]) // ERC20 approvals
        .mockReturnValueOnce([]) // ERC721 approvals
        .mockReturnValueOnce([]) // ApprovalForAll
        .mockReturnValueOnce([]) // ERC20 transfers
        .mockReturnValueOnce([]) // ERC721 transfers
        .mockReturnValueOnce([]); // ERC1155 transfers

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
      expect(mockTxEvent.filterLog).toHaveBeenCalledTimes(6);
      expect(mockGetCode).toHaveBeenCalledTimes(0);
    });

    it('should return findings if there is a ApprovalForAll event', async () => {
      mockTxEvent.filterLog
        .mockReturnValueOnce([]) // ERC20 approvals
        .mockReturnValueOnce([]) // ERC721 approvals
        .mockReturnValueOnce([mockApprovalForAllEvent]) // ApprovalForAll
        .mockReturnValueOnce([]) // ERC20 transfers
        .mockReturnValueOnce([]) // ERC721 transfers
        .mockReturnValueOnce([]); // ERC1155 transfers

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Account got approval for all tokens',
          description: `${spender} obtained transfer approval for all tokens from ${owner1}`,
          alertId: 'ICE-PHISHING-APPROVAL-FOR-ALL',
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            spender,
            owner: owner1,
            asset,
          },
        }),
      ]);
    });

    it('should return findings if there are a high number of Approval events', async () => {
      for (let i = 0; i < 2; i++) {
        const tempTxEvent = {
          filterLog: jest.fn()
            .mockReturnValueOnce([mockApprovalEvents[i]]) // ERC20 approvals
            .mockReturnValueOnce([]) // ERC721 approvals
            .mockReturnValueOnce([]) // ApprovalForAll
            .mockReturnValueOnce([]) // ERC20 transfers
            .mockReturnValueOnce([]) // ERC721 transfers
            .mockReturnValueOnce([]), // ERC1155 transfers
          hash: `hash${i}`,
          timestamp: 1000 * i,
          from: spender,
        };

        await handleTransaction(tempTxEvent);
      }

      mockTxEvent.filterLog
        .mockReturnValueOnce([mockApprovalEvents[2]]) // ERC20 approvals
        .mockReturnValueOnce([]) // ERC721 approvals
        .mockReturnValueOnce([]) // ApprovalForAll
        .mockReturnValueOnce([]) // ERC20 transfers
        .mockReturnValueOnce([]) // ERC721 transfers
        .mockReturnValueOnce([]); // ERC1155 transfers

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'High number of accounts granted approvals for digital assets',
          description: `${spender} obtained transfer approval for 1 assets by 3 accounts over period of 1 days.`,
          alertId: 'ICE-PHISHING-HIGH-NUM-APPROVALS',
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            firstTxHash: 'hash0',
            lastTxHash: 'hash2',
            assetsImpacted: [asset],
          },
        }),
      ]);
    });

    it('should return findings if there are a high number of Transfer events', async () => {
      // Create the Approval events first
      for (let i = 0; i < 3; i++) {
        const tempTxEvent = {
          filterLog: jest.fn()
            .mockReturnValueOnce([mockApprovalEvents[i]]) // ERC20 approvals
            .mockReturnValueOnce([]) // ERC721 approvals
            .mockReturnValueOnce([]) // ApprovalForAll
            .mockReturnValueOnce([]) // ERC20 transfers
            .mockReturnValueOnce([]) // ERC721 transfers
            .mockReturnValueOnce([]), // ERC1155 transfers
          hash: `hash${i}`,
          timestamp: 1000 * i,
          from: spender,
        };

        await handleTransaction(tempTxEvent);
      }

      for (let i = 0; i < 2; i++) {
        const tempTxEvent = {
          filterLog: jest.fn()
            .mockReturnValueOnce([mockApprovalEvents[i]]) // ERC20 approvals
            .mockReturnValueOnce([]) // ERC721 approvals
            .mockReturnValueOnce([]) // ApprovalForAll
            .mockReturnValueOnce([mockTransferEvents[i]]) // ERC20 transfers
            .mockReturnValueOnce([]) // ERC721 transfers
            .mockReturnValueOnce([]), // ERC1155 transfers
          hash: `hash${i}`,
          timestamp: 3000 + 1000 * i,
          from: spender,
        };

        await handleTransaction(tempTxEvent);
      }

      mockTxEvent.filterLog
        .mockReturnValueOnce([mockApprovalEvents[2]]) // ERC20 approvals
        .mockReturnValueOnce([]) // ERC721 approvals
        .mockReturnValueOnce([]) // ApprovalForAll
        .mockReturnValueOnce([mockTransferEvents[2]]) // ERC20 transfers
        .mockReturnValueOnce([]) // ERC721 transfers
        .mockReturnValueOnce([]); // ERC1155 transfers

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: 'Previously approved assets transferred',
          description: `${spender} transferred 1 assets from 3 accounts over period of 1 days.`,
          alertId: 'ICE-PHISHING-HIGH-NUM-APPROVED-TRANSFERS',
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
          metadata: {
            firstTxHash: 'hash0',
            lastTxHash: 'hash2',
            assetsImpacted: [asset],
          },
        }),
      ]);
    });
  });

  describe('handleBlock', () => {
    const timePeriod = 2 * timePeriodDays * 24 * 60 * 60;

    beforeEach(() => {
      resetLastTimestamp();
      Object.keys(getApprovals()).forEach((s) => delete getApprovals()[s]);
      Object.keys(getTransfers()).forEach((s) => delete getTransfers()[s]);
    });

    it('should do nothing if enough time has not passed', async () => {
      const mockBlockEvent = { block: { timestamp: 1000 } };
      getApprovals()[spender] = [{ timestamp: 1000 }];
      getTransfers()[spender] = [{ timestamp: 1000 }];
      await handleBlock(mockBlockEvent);

      expect(Object.keys(getApprovals()).length).toStrictEqual(1);
      expect(Object.keys(getTransfers()).length).toStrictEqual(1);
    });

    it('should not delete the entry if it was updated recently', async () => {
      const mockBlockEvent = { block: { timestamp: timePeriod } };
      getApprovals()[spender] = [{ timestamp: timePeriod }];
      getTransfers()[spender] = [{ timestamp: timePeriod }];
      await handleBlock(mockBlockEvent);

      expect(Object.keys(getApprovals()).length).toStrictEqual(1);
      expect(Object.keys(getTransfers()).length).toStrictEqual(1);
    });

    it('should delete the entry if it was not updated recently', async () => {
      const mockBlockEvent = { block: { timestamp: timePeriod } };
      getApprovals()[spender] = [{ timestamp: 1000 }];
      getTransfers()[spender] = [{ timestamp: 1000 }];
      await handleBlock(mockBlockEvent);

      expect(Object.keys(getApprovals()).length).toStrictEqual(0);
      expect(Object.keys(getTransfers()).length).toStrictEqual(0);
    });
  });
});
