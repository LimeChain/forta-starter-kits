const {
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  ethers,
  createBlockEvent,
} = require("forta-agent");
const {
  provideHandleBlock,
  provideHandleTransaction,
  resetDistributionTracker,
  resetIsRunningJob,
  resetTimestamp,
} = require("./agent");

// Mock the config file
jest.mock('../bot-config.json', () => ({
  protocolName: 'lido',
  bots: [
    {
      botType: "governance",
      name: "",
      contracts: {
        protocol_name: {
          address: "0x2e59A20f205bB85a89C53f1936454680651E618e",
          abiFile: "protocol.json"
        }
      }
    }
  ],
}), { virtual: true });

describe("Governance Voting Power Change", () => {
  describe("handleTransaction", () => {
    const mockTxEvent = createTransactionEvent({});
    const mockBlockEvent = createBlockEvent({});
    mockTxEvent.filterLog = jest.fn();

    const mockTokenContract = {
      balanceOf: jest.fn(),
    };
    const mockGetTokenContract = () => mockTokenContract;

    let handleTransaction;
    let handleBlock;
    let mockAddressTracker;
    beforeEach(() => {
      mockAddressTracker = {};
      mockTxEvent.filterLog = jest.fn().mockReturnValue([]);
      mockTokenContract.balanceOf.mockReset();
      handleTransaction = provideHandleTransaction(
        mockAddressTracker,
        mockGetTokenContract
      );
      handleBlock = provideHandleBlock(mockAddressTracker);
      resetDistributionTracker();
      resetIsRunningJob();
      resetTimestamp();
    });

    it("successfully adds from and to to tracked addresses", async () => {
      const mockFilterResult = {
        args: {
          from: "0x0",
          to: "0x1",
          value: ethers.BigNumber.from(1),
        },
      };
      mockTxEvent.filterLog.mockReturnValueOnce([mockFilterResult]);
      mockTokenContract.balanceOf.mockReturnValue(ethers.BigNumber.from(1000));
      await handleTransaction(mockTxEvent);
      expect(mockAddressTracker[mockFilterResult.args.to].newBalance).toBe(
        1000
      );
      expect(mockAddressTracker[mockFilterResult.args.from].newBalance).toBe(
        1000
      );
    });

    it("successfully sets tokens accumulated if percentage difference is greater than threshholdOfAditionalVotingPowerAccumulated", async () => {
      const mockFilterResult = {
        args: {
          from: "0x0",
          to: "0x1",
          value: ethers.BigNumber.from(1),
        },
      };
      const mockFilterResultTwo = {
        args: {
          from: "0x0",
          to: "0x1",
          value: ethers.BigNumber.from(499),
        },
      };
      mockTxEvent.filterLog.mockReturnValueOnce([
        mockFilterResult,
        mockFilterResultTwo,
      ]);
      mockTokenContract.balanceOf.mockReturnValue(ethers.BigNumber.from("1"));
      await handleTransaction(mockTxEvent);
      expect(
        mockAddressTracker[mockFilterResult.args.to].tokensAccumulated
      ).toBe(500);
    });

    it("returns no findings if the time passed < accumulation period", async () => {
      const mockFilterResult = {
        args: {
          from: "0x0",
          to: "0x1",
          value: ethers.BigNumber.from(1),
        },
      };
      const mockFilterResultTwo = {
        args: {
          from: "0x0",
          to: "0x1",
          value: ethers.BigNumber.from(499),
        },
      };
      mockTxEvent.filterLog.mockReturnValueOnce([
        mockFilterResult,
        mockFilterResultTwo,
      ]);
      mockTokenContract.balanceOf.mockReturnValue(ethers.BigNumber.from("1"));
      await handleTransaction(mockTxEvent);
      mockBlockEvent.block = { timestamp: 0 };
      const findings = await handleBlock(mockBlockEvent);
      expect(findings).toStrictEqual([]);
    });

    it("returns a finding if accumulation is greater than accumulationThreshold", async () => {
      const mockFilterResult = {
        args: {
          from: "0x0",
          to: "0x1",
          value: ethers.BigNumber.from(1),
        },
      };
      const mockFilterResultTwo = {
        args: {
          from: "0x0",
          to: "0x1",
          value: ethers.BigNumber.from(499),
        },
      };
      mockTxEvent.filterLog.mockReturnValueOnce([
        mockFilterResult,
        mockFilterResultTwo,
      ]);
      mockTokenContract.balanceOf.mockReturnValue(ethers.BigNumber.from("1"));
      await handleTransaction(mockTxEvent);
      mockBlockEvent.block = { timestamp: 605_000 };
      const findings = await handleBlock(mockBlockEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Significant accumulation of voting power",
          description: `0x1 accumulating 50% of voting power `,
          alertId: "SIGNIFICANT-VOTING-POWER-ACCUMULATION",
          protocol: "lido",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {},
        }),
      ]);
    });

    it("returns a finding if accumulation is greater than threshold and hasVoted", async () => {
      const randomAddress = ethers.Wallet.createRandom().address;
      const mockFilterResult = {
        args: {
          from: "0x0",
          to: randomAddress,
          value: ethers.BigNumber.from(1),
        },
      };
      const mockFilterResultTwo = {
        args: {
          from: "0x0",
          to: randomAddress,
          value: ethers.BigNumber.from(499),
        },
      };
      const mockFilterResultThree = {
        args: {
          voteId: ethers.BigNumber.from(5),
          voter: randomAddress,
        },
      };

      mockTxEvent.filterLog
        .mockReturnValueOnce([mockFilterResult, mockFilterResultTwo])
        .mockReturnValueOnce([mockFilterResultThree]);
      mockTokenContract.balanceOf.mockReturnValue(ethers.BigNumber.from("1"));

      await handleTransaction(mockTxEvent);

      mockBlockEvent.block = { timestamp: 607_000 };

      const findings = await handleBlock(mockBlockEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Significant accumulation of voting power voted",
          description: `${randomAddress} accumulating 50% of voting power and voted on proposal 5 `,
          alertId: "SIGNIFICANT-VOTING-POWER-ACCUMULATION-VOTE",
          protocol: "lido",
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {},
        }),
      ]);
    });

    it("should return a finding if hasn't voted but distributed accumulated tokens greater than distribution threshold", async () => {
      const randomAddress = ethers.Wallet.createRandom().address;
      const mockFilterResult = {
        args: {
          from: "0x0",
          to: randomAddress,
          value: ethers.BigNumber.from(1),
        },
      };
      const mockFilterResultTwo = {
        args: {
          from: "0x0",
          to: randomAddress,
          value: ethers.BigNumber.from(499),
        },
      };

      const mockFilterResultThree = {
        args: {
          from: randomAddress,
          to: "0x123",
          value: ethers.BigNumber.from(400),
        },
      };

      mockTxEvent.filterLog
        .mockReturnValueOnce([mockFilterResult, mockFilterResultTwo])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([mockFilterResultThree]);
      mockTokenContract.balanceOf.mockReturnValue(ethers.BigNumber.from("1"));

      await handleTransaction(mockTxEvent);

      mockBlockEvent.block = { timestamp: 607_000 };
      await handleBlock(mockBlockEvent);
      resetTimestamp();
      await handleTransaction(mockTxEvent);
      const findings = await handleBlock(mockBlockEvent);
      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Significant accumulation/distribution of voting power",
          description: `${randomAddress} accumulated and then distributed 80% of voting power possibly indicating a govt attack  `,
          alertId: "SIGNIFICANT-VOTING-POWER-ACCUMULATION-DISTRIBUTION",
          protocol: "lido",
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {},
        }),
      ]);
    });

    it("should return a finding if voted and distributed accumulated tokens greater than distribution threshold", async () => {
      const randomAddress = ethers.Wallet.createRandom().address;
      const mockFilterResult = {
        args: {
          from: "0x0",
          to: randomAddress,
          value: ethers.BigNumber.from(1),
        },
      };
      const mockFilterResultTwo = {
        args: {
          from: "0x0",
          to: randomAddress,
          value: ethers.BigNumber.from(499),
        },
      };

      const mockFilterResultThree = {
        args: {
          from: randomAddress,
          to: "0x123",
          value: ethers.BigNumber.from(400),
        },
      };

      const mockFilterResultFour = {
        args: {
          voteId: ethers.BigNumber.from(5),
          voter: randomAddress,
        },
      };

      mockTxEvent.filterLog
        .mockReturnValueOnce([mockFilterResult, mockFilterResultTwo])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([mockFilterResultThree])
        .mockReturnValueOnce([mockFilterResultFour]);
      mockTokenContract.balanceOf.mockReturnValue(ethers.BigNumber.from("1"));

      await handleTransaction(mockTxEvent);

      mockBlockEvent.block = { timestamp: 607_000 };
      await handleBlock(mockBlockEvent);
      resetTimestamp();
      await handleTransaction(mockTxEvent);
      const findings = await handleBlock(mockBlockEvent);
      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Significant accumulation/distribution of voting power voted",
          description: `${randomAddress} accumulated and then distributed 80% of voting power and voted on proposal 5 possibly indicating a govt attack  `,
          alertId: "SIGNIFICANT-VOTING-POWER-ACCUMULATION-DISTRIBUTION-VOTE",
          protocol: "lido",
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {},
        }),
      ]);
    });
  });
});
