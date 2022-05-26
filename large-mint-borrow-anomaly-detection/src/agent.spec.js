const {
  FindingType,
  FindingSeverity,
  Finding,
  ethers,
} = require("forta-agent");
const { provideHandleTransaction, provideHandleBlock } = require("./agent");
const ADDRESS_ZERO = ethers.constants.AddressZero;
const ARIMA_CONFIG = {
  p: 2,
  d: 1,
  q: 2,
  P: 1,
  D: 0,
  Q: 1,
  s: 2,
  verbose: false,
};
jest.mock("./agent.config.js", () => {
  const defaultModule = jest.requireActual("./agent.config.js");
  return {
    ...defaultModule,
    globalSensitivity: 1,
  };
});

describe("Transaction Volume Anomaly Detection", () => {
  describe("handleTransaction", () => {
    let mockMintTxEvent = {
      to: "0x123",
      from: "0x1234",
      block: {
        number: "1234",
        timestamp: 3,
      },
      transaction: {
        hash: "0x00x",
      },
      filterLog: jest.fn(),
    };

    let mockBorrowEvent = {
      to: "0x123",
      from: "0x1234",
      block: {
        number: "1234",
        timestamp: 3,
      },
      transaction: {
        hash: "0x00x",
      },
      filterLog: jest.fn(),
    };

    let mockTrackerBuckets;

    let handleTransaction;

    let handleBlock;

    beforeEach(() => {
      mockMintTxEvent = {
        to: "0x123",
        from: "0x1234",
        block: {
          number: "1234",
          timestamp: 3,
        },
        transaction: {
          hash: "0x00x",
        },
        filterLog: jest.fn(),
      };
      mockBorrowEvent = {
        to: "0x123",
        from: "0x1234",
        block: {
          number: "1234",
          timestamp: 3,
        },
        transaction: {
          hash: "0x00x",
        },
        filterLog: jest.fn(),
      };
      mockMintTxEvent.filterLog.mockReset();
      mockBorrowEvent.filterLog.mockReset();
      mockTrackerBuckets = [];
      handleTransaction = provideHandleTransaction(mockTrackerBuckets);
      handleBlock = provideHandleBlock(mockTrackerBuckets);
    });

    it("Successfully adds address to tracker bucket on mint transaction with from element in the same block", async () => {
      mockMintTxEvent.filterLog.mockReturnValue([
        { args: { from: ADDRESS_ZERO, to: "0x1234", value: 10 } },
      ]);

      await handleTransaction(mockMintTxEvent);

      expect(mockMintTxEvent.filterLog).toBeCalledTimes(1);
      expect(mockTrackerBuckets.length).toBe(1);
    });

    it("Successfully adds address to tracker bucket on borrow transaction with _reserve element in the same block", async () => {
      mockBorrowEvent.filterLog.mockReturnValue([
        { args: { _reserve: "0x123", _user: "0x1234", _amount: 10 } },
      ]);
      await handleTransaction(mockBorrowEvent);

      expect(mockBorrowEvent.filterLog).toBeCalledTimes(1);
      expect(mockTrackerBuckets.length).toBe(1);
    });

    it("Successfully adds address to tracker bucket on borrow transaction with minter element in the same block", async () => {
      mockMintTxEvent.filterLog.mockReturnValue([
        { args: { _reserve: "0x123", minter: "0x1234" } },
      ]);
      await handleTransaction(mockMintTxEvent);

      expect(mockMintTxEvent.filterLog).toBeCalledTimes(1);
      expect(mockTrackerBuckets.length).toBe(1);
    });

    it("Successfully adds address to tracker bucket on borrow transaction with borrower element in the same block", async () => {
      mockBorrowEvent.filterLog.mockReturnValue([
        { args: { _reserve: "0x123", borrower: "0x1234" } },
      ]);
      await handleTransaction(mockBorrowEvent);

      expect(mockBorrowEvent.filterLog).toBeCalledTimes(1);
      expect(mockTrackerBuckets.length).toBe(1);
    });

    it("Successfully keeps track of mint transactions in buckets", async () => {
      mockMintTxEvent.filterLog.mockReturnValue([
        { args: { from: ADDRESS_ZERO, to: "0x1234", value: 10 } },
      ]);
      await handleTransaction(mockMintTxEvent);
      mockMintTxEvent.block.timestamp = 10;
      await handleTransaction(mockMintTxEvent);

      expect(mockMintTxEvent.filterLog).toBeCalledTimes(2);
      expect(mockTrackerBuckets.length).toBe(1);
      expect(mockTrackerBuckets[0].totalAssetsMinted).toStrictEqual([10, 10]);
      expect(mockTrackerBuckets[0].trackingMints.length).toBe(1);
      expect(mockTrackerBuckets[0].totalMintsForRange).toBe(2);
    });

    it("Successfully keeps track of borrow transactions in buckets", async () => {
      mockBorrowEvent.filterLog.mockReturnValue([
        { args: { _reserve: "0x123", borrower: "0x1234", _amount: 10 } },
      ]);
      await handleTransaction(mockBorrowEvent);
      mockBorrowEvent.block.timestamp = 10;
      await handleTransaction(mockBorrowEvent);

      expect(mockBorrowEvent.filterLog).toBeCalledTimes(2);
      expect(mockTrackerBuckets.length).toBe(1);
      expect(mockTrackerBuckets[0].trackingBorrows.length).toBe(1);
      expect(mockTrackerBuckets[0].totalAssetsBorrowed).toStrictEqual([10, 10]);
      expect(mockTrackerBuckets[0].totalBorrowsForRange).toBe(2);
    });

    it("Returns no findings if there are no mint anomalies", async () => {
      for (let i = 0; i < 8; i++) {
        mockMintTxEvent.filterLog.mockReturnValue([
          { args: { from: ADDRESS_ZERO, to: "0x1234", value: 1 } },
        ]);
        await handleTransaction(mockMintTxEvent);
        mockMintTxEvent.block.timestamp = 10;
      }
      mockMintTxEvent.block.number = "1235";
      for (let i = 0; i < 9; i++) {
        mockMintTxEvent.filterLog.mockReturnValue([
          { args: { from: ADDRESS_ZERO, to: "0x1234", value: 1 } },
        ]);
        await handleTransaction(mockMintTxEvent);
      }
      mockMintTxEvent.block.number = "1236";
      for (let i = 0; i < 11; i++) {
        mockMintTxEvent.filterLog.mockReturnValue([
          { args: { from: ADDRESS_ZERO, to: "0x1234", value: 1 } },
        ]);
        await handleTransaction(mockMintTxEvent);
      }

      mockMintTxEvent.block.number = "1237";
      for (let i = 0; i < 7; i++) {
        mockMintTxEvent.filterLog.mockReturnValue([
          { args: { from: ADDRESS_ZERO, to: "0x1234", value: 1 } },
        ]);
        await handleTransaction(mockMintTxEvent);
      }

      mockMintTxEvent.block.number = "1238";
      for (let i = 0; i < 8; i++) {
        mockMintTxEvent.filterLog.mockReturnValue([
          { args: { from: ADDRESS_ZERO, to: "0x1234", value: 1 } },
        ]);
        await handleTransaction(mockMintTxEvent);
      }

      mockMintTxEvent.block.number = "1239";
      for (let i = 0; i < 9; i++) {
        mockMintTxEvent.filterLog.mockReturnValue([
          { args: { from: ADDRESS_ZERO, to: "0x1234", value: 1 } },
        ]);
        await handleTransaction(mockMintTxEvent);
      }

      const findings = await handleBlock();

      expect(findings).toStrictEqual([]);
    });

    it("Returns no findings if there are no borrow anomalies", async () => {
      for (let i = 0; i < 8; i++) {
        mockBorrowEvent.filterLog.mockReturnValue([
          { args: { _reserve: "0x123", borrower: "0x1234", _amount: 1 } },
        ]);
        await handleTransaction(mockBorrowEvent);
        mockBorrowEvent.block.timestamp = 10;
      }
      mockBorrowEvent.block.number = "1235";
      for (let i = 0; i < 9; i++) {
        mockBorrowEvent.filterLog.mockReturnValue([
          { args: { _reserve: "0x123", borrower: "0x1234", _amount: 1 } },
        ]);
        await handleTransaction(mockBorrowEvent);
      }
      mockBorrowEvent.block.number = "1236";
      for (let i = 0; i < 11; i++) {
        mockBorrowEvent.filterLog.mockReturnValue([
          { args: { _reserve: "0x123", borrower: "0x1234", _amount: 1 } },
        ]);
        await handleTransaction(mockBorrowEvent);
      }

      mockBorrowEvent.block.number = "1237";
      for (let i = 0; i < 7; i++) {
        mockBorrowEvent.filterLog.mockReturnValue([
          { args: { _reserve: "0x123", borrower: "0x1234", _amount: 1 } },
        ]);
        await handleTransaction(mockBorrowEvent);
      }

      mockBorrowEvent.block.number = "1238";
      for (let i = 0; i < 8; i++) {
        mockBorrowEvent.filterLog.mockReturnValue([
          { args: { _reserve: "0x123", borrower: "0x1234", _amount: 1 } },
        ]);
        await handleTransaction(mockBorrowEvent);
      }

      mockBorrowEvent.block.number = "1239";
      for (let i = 0; i < 9; i++) {
        mockBorrowEvent.filterLog.mockReturnValue([
          { args: { _reserve: "0x123", borrower: "0x1234", _amount: 1 } },
        ]);
        await handleTransaction(mockBorrowEvent);
      }

      const findings = await handleBlock();

      expect(findings).toStrictEqual([]);
    });

    it("Returns a finding if there are  mint anomalies", async () => {
      mockMintTxEvent.filterLog.mockReturnValue([
        { args: { from: ADDRESS_ZERO, to: "0x1234", value: 10 } },
      ]);
      await handleTransaction(mockMintTxEvent);

      mockMintTxEvent.block.timestamp = 10;
      mockMintTxEvent.filterLog.mockReturnValue([
        { args: { from: ADDRESS_ZERO, to: "0x1234", value: 8 } },
      ]);
      await handleTransaction(mockMintTxEvent);

      mockMintTxEvent.filterLog.mockReturnValue([
        { args: { from: ADDRESS_ZERO, to: "0x1234", value: 10 } },
      ]);
      await handleTransaction(mockMintTxEvent);

      mockMintTxEvent.filterLog.mockReturnValue([
        { args: { from: ADDRESS_ZERO, to: "0x1234", value: 11 } },
      ]);
      await handleTransaction(mockMintTxEvent);

      mockMintTxEvent.filterLog.mockReturnValue([
        { args: { from: ADDRESS_ZERO, to: "0x1234", value: 10 } },
      ]);
      await handleTransaction(mockMintTxEvent);
      mockMintTxEvent.block.timestamp = 3;
      mockMintTxEvent.filterLog.mockReturnValue([
        { args: { from: ADDRESS_ZERO, to: "0x1234", value: 1000 } },
      ]);
      await handleTransaction(mockMintTxEvent);

      const findings = await handleBlock();

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Large mint volume",
          description: `0x1234 minted an unusually high number of 1000 assets 0x123`,
          alertId: "HIGH-MINT-VALUE",
          severity: FindingSeverity.Medium,
          type: FindingType.Exploit,
          metadata: {
            FIRST_TRANSACTION_HASH: "0x00x",
            LAST_TRANSACTION_HASH: "0x00x",
            ASSET_IMPACTED: "0x123",
            BASELINE_VOLUME: 8,
          },
        }),
      ]);
    });
    it("Returns a findings if there are  borrow anomalies", async () => {
      mockBorrowEvent.filterLog.mockReturnValue([
        { args: { borrower: "0x1234", borrowAmount: 10 } },
      ]);
      await handleTransaction(mockBorrowEvent);
      mockBorrowEvent.block.timestamp = 10;
      mockBorrowEvent.filterLog.mockReturnValue([
        { args: { borrower: "0x1234", borrowAmount: 10 } },
      ]);
      await handleTransaction(mockBorrowEvent);

      mockBorrowEvent.filterLog.mockReturnValue([
        { args: { borrower: "0x1234", borrowAmount: 10 } },
      ]);
      await handleTransaction(mockBorrowEvent);

      mockBorrowEvent.filterLog.mockReturnValue([
        { args: { borrower: "0x1234", borrowAmount: 10 } },
      ]);
      await handleTransaction(mockBorrowEvent);

      mockBorrowEvent.filterLog.mockReturnValue([
        { args: { borrower: "0x1234", borrowAmount: 10 } },
      ]);
      await handleTransaction(mockBorrowEvent);

      mockBorrowEvent.block.timestamp = 3;
      mockBorrowEvent.filterLog.mockReturnValue([
        { args: { borrower: "0x1234", borrowAmount: 1000 } },
      ]);
      await handleTransaction(mockBorrowEvent);

      const findings = await handleBlock();

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Large borrow volume",
          description: `0x1234 borrowed an unusually high number of 1000 assets 0x123`,
          alertId: "HIGH-BORROW-VALUE",
          severity: FindingSeverity.Medium,
          type: FindingType.Exploit,
          metadata: {
            FIRST_TRANSACTION_HASH: "0x00x",
            LAST_TRANSACTION_HASH: "0x00x",
            ASSET_IMPACTED: "0x123",
            BASELINE_VOLUME: 10,
          },
        }),
      ]);
    });
  });
});
