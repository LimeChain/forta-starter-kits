const mockEthcallProviderAll = jest.fn();
const mockBalanceOf = jest.fn();

const {
  FindingType,
  FindingSeverity,
  Finding,
  ethers,
} = require('forta-agent');
const { hashCode } = require('./helper');
const {
  handleTransaction,
  handleBlock,
  getTransfersObj,
} = require('./agent');

const asset = ethers.Wallet.createRandom().address;
const address1 = ethers.Wallet.createRandom().address;
const address2 = ethers.Wallet.createRandom().address;
const address3 = ethers.Wallet.createRandom().address;

const hashCode1 = hashCode(address1, asset);
const hashCode2 = hashCode(address2, asset);
const hashCode3 = hashCode(address3, asset);

const symbol = 'TOKEN';

jest.mock('ethers-multicall', () => {
  const original = jest.requireActual('ethers-multicall');
  return {
    ...original,
    Provider: jest.fn().mockImplementation(() => ({
      all: mockEthcallProviderAll,
    })),
  };
});

jest.mock('forta-agent', () => {
  const original = jest.requireActual('forta-agent');
  return {
    ...original,
    getEthersProvider: jest.fn().mockImplementation(() => ({
      _isSigner: true,
      getCode: () => '0x000000',
    })),
    ethers: {
      ...original.ethers,
      Contract: jest.fn().mockImplementation(() => ({
        balanceOf: mockBalanceOf,
        symbol: () => symbol,
      })),
    },
  };
});

describe('asset drained bot', () => {
  describe('handleTransaction', () => {
    const mockTxEvent = {
      filterLog: jest.fn(),
      traces: [],
    };

    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
      Object.keys(getTransfersObj()).forEach((key) => delete getTransfersObj()[key]);
    });

    it('should do nothing if there are no transfers', async () => {
      mockTxEvent.filterLog.mockReturnValueOnce([]);
      await handleTransaction(mockTxEvent);
      expect(Object.keys(getTransfersObj()).length).toStrictEqual(0);
    });

    it('should add transfers in the object if there are transfers', async () => {
      const mockTransferEvent1 = {
        address: asset,
        args: {
          from: address1,
          to: address2,
          value: ethers.BigNumber.from(10),
        },
      };
      const mockTransferEvent2 = {
        address: asset,
        args: {
          from: address2,
          to: address3,
          value: ethers.BigNumber.from(10),
        },
      };
      mockTxEvent.filterLog.mockReturnValueOnce([mockTransferEvent1, mockTransferEvent2]);

      await handleTransaction(mockTxEvent);
      expect(Object.keys(getTransfersObj()).length).toStrictEqual(3);
      expect(getTransfersObj()[hashCode1]).toStrictEqual({
        asset,
        address: address1,
        value: ethers.BigNumber.from(-10),
      });
      expect(getTransfersObj()[hashCode2]).toStrictEqual({
        asset,
        address: address2,
        value: ethers.BigNumber.from(0),
      });
      expect(getTransfersObj()[hashCode3]).toStrictEqual({
        asset,
        address: address3,
        value: ethers.BigNumber.from(10),
      });
    });
  });

  describe('handleBlock', () => {
    const mockTxEvent = {
      filterLog: jest.fn(),
      traces: [],
    };
    const mockBlockEvent = { blockNumber: 10_000 };

    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
      Object.keys(getTransfersObj()).forEach((key) => delete getTransfersObj()[key]);
    });

    it('should not alert if there are no transfers', async () => {
      mockTxEvent.filterLog.mockReturnValueOnce([]);
      await handleTransaction(mockTxEvent);
      const findings = await handleBlock(mockBlockEvent);
      expect(findings).toStrictEqual([]);
    });

    it('should alert if there are contracts with fully drained assets', async () => {
      const mockTransferEvent1 = {
        address: asset,
        args: {
          from: address1,
          to: address2,
          value: ethers.BigNumber.from(10),
        },
      };
      mockTxEvent.filterLog.mockReturnValueOnce([mockTransferEvent1]);
      mockEthcallProviderAll.mockResolvedValueOnce([ethers.BigNumber.from(0)]);
      mockBalanceOf.mockResolvedValueOnce(ethers.BigNumber.from(10)); // Mock balance 10 mins ago

      await handleTransaction(mockTxEvent);
      const findings = await handleBlock(mockBlockEvent);
      expect(mockEthcallProviderAll).toHaveBeenCalledTimes(1);
      expect(findings).toStrictEqual([Finding.fromObject({
        name: 'Asset drained',
        description: `All ${symbol} tokens were drained from ${address1}`,
        alertId: 'ASSET-DRAINED',
        severity: FindingSeverity.High,
        type: FindingType.Exploit,
        metadata: {
          contract: address1,
          asset,
        },
      })]);
    });
  });
});
