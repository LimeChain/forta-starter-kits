const {
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  ethers,
} = require("forta-agent");
const { provideHandleTransaction, provideHandleBlock } = require("./agent");
const AddressApprovalTracker = require("./AddressApprovalTracker");
jest.mock("./agent.config.js", () => {
  return {
    __esModule: true,
    DEX_AND_CEX_ADDRESSES: [],
    ApprovalThreshold: 30,
    ApprovalTimePeriod: 5,
  };
});

describe("Ice phishing detection bot", () => {
  describe("handleTransaction", () => {
    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.filterLog = jest.fn();
    const mockValidContract = jest.fn();
    let mockAddressesTracked = [];
    let mockValidAddresses = new Set();
    let mockInvalidAddresses = new Set();
    let handleTransaction;
    let handleBlock;
    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
      mockValidContract.mockReset();
      mockAddressesTracked = [];
      mockInvalidAddresses = new Set(["0x123", "0x1234"]);
      mockValidAddresses = new Set();
      handleTransaction = provideHandleTransaction(
        mockAddressesTracked,
        mockValidAddresses,
        mockInvalidAddresses
      );
      handleBlock = provideHandleBlock(mockAddressesTracked, mockValidContract);
    });

    it("should successfully add approval to Address Approval tracker for address", async () => {
      mockTxEvent.filterLog.mockReturnValue([
        {
          name: "Approval",
          args: {
            spender: "0x123",
          },
          address: "0x1234",
        },
      ]);
      mockTxEvent.transaction = {
        from: "0x123",
        to: "0x1234",
        hash: "0x0",
      };

      await handleTransaction(mockTxEvent);

      expect(mockAddressesTracked["0x123"].trackingApprovals.length).toBe(1);
    });

    it("should successfully add transfer to Address Approval tracker for address", async () => {
      mockTxEvent.filterLog.mockReturnValue([
        {
          name: "Approval",
          args: {
            spender: "0x123",
          },
          address: "0x1234",
        },
      ]);
      mockTxEvent.transaction = {
        from: "0x123",
        to: "0x1234",
        hash: "0x0",
      };

      await handleTransaction(mockTxEvent);

      mockTxEvent.filterLog.mockReturnValue([
        {
          name: "Transfer",
          args: {
            from: "0x123",
            to: "0x1234",
          },
          address: "0x1234",
        },
      ]);
      mockTxEvent.transaction = {
        from: "0x123",
        to: "0x1234",
        hash: "0x0",
      };

      await handleTransaction(mockTxEvent);

      expect(mockAddressesTracked["0x123"].trackingTransfers.length).toBe(1);
    });

    it("Returns no findings if there are no high number of accounts with granted approvals for digital assets", async () => {
      mockTxEvent.filterLog.mockReturnValue([
        {
          name: "Approval",
          args: {
            spender: "0x123",
          },
        },
      ]);
      mockTxEvent.transaction = {
        from: "0x123",
        to: "0x1234",
        hash: "0x0",
      };

      await handleTransaction(mockTxEvent);

      const findings = await handleBlock();

      expect(findings).toStrictEqual([]);
    });

    it("Returns no findings if there are no transfers with granted approvals for digital assets", async () => {
      mockTxEvent.filterLog.mockReturnValue([
        {
          name: "Transfer",
          args: {
            from: "0x123",
            to: "0x1234",
          },
        },
      ]);
      mockTxEvent.transaction = {
        from: "0x123",
        to: "0x1234",
        hash: "0x0",
      };

      await handleTransaction(mockTxEvent);

      const findings = await handleBlock();

      expect(findings).toStrictEqual([]);
    });

    it("Returns a finding if there are high amount of approvals for digital assets", async () => {
      mockTxEvent.filterLog.mockReturnValue([
        {
          name: "Approval",
          args: {
            spender: "0x123",
          },
          address: "0x1234",
        },
      ]);
      mockTxEvent.transaction = {
        from: "0x123",
        to: "0x1234",
        hash: "0x0",
      };

      for (let i = 0; i < 100; i++) {
        await handleTransaction(mockTxEvent);
      }

      const findings = await handleBlock();

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "High number of accounts granted approvals for digital assets",
          description: `0x123 obtained transfer approval for 1 assets by 100 accounts over period of 0 days`,
          alertId: "ICE-PHISHING-HIGH-NUM-APPROVALS",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            FIRST_TRANSACTION_HASH: "0x0",
            LAST_TRANSACTION_HASH: "0x0",
            ASSETS_IMPACTED: ["0x1234"],
          },
        }),
      ]);
    });

    it("Returns a finding if there are high amount of transfers for digital assets that were approved", async () => {
      mockTxEvent.filterLog.mockReturnValue([
        {
          name: "Approval",
          args: {
            spender: "0x123",
          },
          address: "0x1234",
        },
      ]);
      mockTxEvent.transaction = {
        from: "0x123",
        to: "0x1234",
        hash: "0x0",
      };

      for (let i = 0; i < 100; i++) {
        await handleTransaction(mockTxEvent);
      }
      mockTxEvent.filterLog.mockReturnValue([
        {
          name: "Transfer",
          args: {
            from: "0x123",
            to: "0x1234",
          },
          address: "0x1234",
        },
      ]);
      mockTxEvent.transaction = {
        from: "0x123",
        to: "0x1234",
        hash: "0x0",
      };

      for (let i = 0; i < 100; i++) {
        await handleTransaction(mockTxEvent);
      }
      jest
        .spyOn(AddressApprovalTracker.prototype, "isPastThreshold")
        .mockImplementation(() => {
          return true;
        });

      const findings = await handleBlock();

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "High number of accounts granted approvals for digital assets",
          description: `0x123 obtained transfer approval for 1 assets by 100 accounts over period of 0 days`,
          alertId: "ICE-PHISHING-HIGH-NUM-APPROVALS",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            FIRST_TRANSACTION_HASH: "0x0",
            LAST_TRANSACTION_HASH: "0x0",
            ASSETS_IMPACTED: ["0x1234"],
          },
        }),
        Finding.fromObject({
          name: "Previously approved assets transferred",
          description: `0x123 transferred 1 assets from 1 accounts over period of 0 days`,
          alertId: "ICE-PHISHING-PREV-APPROVED-TRANSFERED",
          severity: FindingSeverity.High,
          type: FindingType.Exploit,
          metadata: {
            FIRST_TRANSACTION_HASH: "0x0",
            LAST_TRANSACTION_HASH: "0x0",
            ASSETS_IMPACTED: ["0x1234"],
          },
        }),
      ]);
    });
  });
});
