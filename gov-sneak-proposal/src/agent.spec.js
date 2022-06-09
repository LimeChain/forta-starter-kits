const { BigNumber } = require("ethers");
const {
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
} = require("forta-agent");
const {
  provideHandleTransaction,
  setPCTBASE,
  setMinQuorum,
  provideHandleBlock,
  resetIsRunningJob,
} = require("./agent");

describe("SneakProposal", () => {
  describe("handleTransaction", () => {
    const mockTxEvent = {
      filterLog: jest.fn(),
    };
    const mockEventNames = ["StartVote", "CastVote", "ExecuteVote"];
    let mockProposalTracker = {};
    let handleTransaction;
    setPCTBASE(10000);
    setMinQuorum(5000);
    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
      mockProposalTracker = {};
      handleTransaction = provideHandleTransaction(
        mockProposalTracker,
        mockEventNames
      );
    });

    it("Should successfully add to proposalTracker on create proposal event", async () => {
      const mockProposalCreateEvent = {
        name: "StartVote",
        args: {
          voteId: 1,
          creator: ethers.Wallet.createRandom().address,
        },
      };

      mockTxEvent.filterLog.mockReturnValue([mockProposalCreateEvent]);
      await handleTransaction(mockTxEvent);
      expect(
        mockProposalTracker[mockProposalCreateEvent.args.voteId]
      ).toStrictEqual({
        currentPCT: 0,
        currentVotes: 0,
        executed: false,
        totalVoted: 0,
        voters: [mockProposalCreateEvent.args.creator],
      });
    });

    it("Should successfully increment votes on proposal tracker if there is a vote event", async () => {
      const mockProposalVoteEvent = {
        name: "CastVote",
        args: {
          voteId: 1,
          voter: ethers.Wallet.createRandom().address,
          bool: true,
          stake: BigNumber.from("10000"),
        },
      };

      mockTxEvent.filterLog.mockReturnValue([mockProposalVoteEvent]);
      await handleTransaction(mockTxEvent);
      expect(
        mockProposalTracker[mockProposalVoteEvent.args.voteId]
      ).toStrictEqual({
        currentPCT: BigNumber.from("0x4e20"),
        currentVotes: BigNumber.from("0x2710"),
        executed: false,
        totalVoted: 1,
        voters: [mockProposalVoteEvent.args.voter],
      });
    });

    it("Should successfully flag proposal as executed on execute event", async () => {
      const mockProposalVoteEvent = {
        name: "CastVote",
        args: {
          voteId: 1,
          voter: ethers.Wallet.createRandom().address,
          bool: true,
          stake: BigNumber.from("10000"),
        },
      };

      const mockProposalExecuteEvent = {
        name: "ExecuteVote",
        args: {
          voteId: 1,
        },
      };

      mockTxEvent.filterLog.mockReturnValue([
        mockProposalVoteEvent,
        mockProposalExecuteEvent,
      ]);
      await handleTransaction(mockTxEvent);
      expect(
        mockProposalTracker[mockProposalVoteEvent.args.voteId]
      ).toStrictEqual({
        currentPCT: BigNumber.from("0x4e20"),
        currentVotes: BigNumber.from("0x2710"),
        executed: true,
        totalVoted: 1,
        voters: [mockProposalVoteEvent.args.voter],
      });
    });
  });

  describe("handleBlock", () => {
    const mockTxEvent = {
      filterLog: jest.fn(),
    };
    const mockEventNames = ["StartVote", "CastVote", "ExecuteVote"];
    let mockProposalTracker = {};
    let handleTransaction;
    let handleBlock;

    beforeEach(() => {
      setPCTBASE(10000);
      setMinQuorum(5000);
      resetIsRunningJob();
      mockTxEvent.filterLog.mockReset();
      mockProposalTracker = {};
      handleTransaction = provideHandleTransaction(
        mockProposalTracker,
        mockEventNames
      );
      handleBlock = provideHandleBlock(mockProposalTracker);
    });

    it("Should return no findings if there are no sneak proposals accepted", async () => {
      const mockProposalVoteEvent = {
        name: "CastVote",
        args: {
          voteId: 1,
          voter: ethers.Wallet.createRandom().address,
          bool: true,
          stake: BigNumber.from("1"),
        },
      };

      const mockProposalExecuteEvent = {
        name: "ExecuteVote",
        args: {
          voteId: 1,
        },
      };
      mockTxEvent.filterLog.mockReturnValue([
        mockProposalVoteEvent,
        mockProposalVoteEvent,
        mockProposalVoteEvent,
        mockProposalVoteEvent,
        mockProposalExecuteEvent,
      ]);
      await handleTransaction(mockTxEvent);

      const findings = await handleBlock();
      expect(findings).toStrictEqual([]);
    });

    it("Should return no findings if there are no sneak proposals close to being accepted", async () => {
      const mockProposalVoteEvent = {
        name: "CastVote",
        args: {
          voteId: 1,
          voter: ethers.Wallet.createRandom().address,
          bool: true,
          stake: BigNumber.from("10000"),
        },
      };

      mockTxEvent.filterLog.mockReturnValue([
        mockProposalVoteEvent,
        mockProposalVoteEvent,
      ]);
      await handleTransaction(mockTxEvent);

      const findings = await handleBlock();
      expect(findings).toStrictEqual([]);
    });

    it("Should return a finding if there is a sneak proposals being accepted", async () => {
      const mockProposalVoteEvent = {
        name: "CastVote",
        args: {
          voteId: 1,
          voter: ethers.Wallet.createRandom().address,
          bool: true,
          stake: BigNumber.from("10000"),
        },
      };

      const mockProposalExecuteEvent = {
        name: "ExecuteVote",
        args: {
          voteId: 1,
        },
      };

      mockTxEvent.filterLog.mockReturnValue([
        mockProposalVoteEvent,
        mockProposalVoteEvent,
        mockProposalExecuteEvent,
      ]);

      await handleTransaction(mockTxEvent);

      const findings = await handleBlock();
      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Sneak Governance Proposal Approval Passed",
          description: `Governance proposal was approved with votes from only 2 accounts`,
          alertId: "SNEAK-GOVT-PROPOSAL-APPROVAL-PASSED",
          protocol: "lido",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
          metadata: {
            ACCOUNTS:
              mockProposalTracker[mockProposalVoteEvent.args.voteId].voters,
          },
        }),
      ]);
    });

    it("Should return a finding if there is a sneak proposal close to being accepted", async () => {
      const mockProposalVoteEvent = {
        name: "CastVote",
        args: {
          voteId: 1,
          voter: ethers.Wallet.createRandom().address,
          bool: true,
          stake: BigNumber.from("1200"),
        },
      };

      mockTxEvent.filterLog.mockReturnValue([
        mockProposalVoteEvent,
        mockProposalVoteEvent,
      ]);

      await handleTransaction(mockTxEvent);

      const findings = await handleBlock();
      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Sneak Governance Proposal Approval About To Pass",
          description: `Governance proposal is about to pass with votes from only 2 accounts `,
          alertId: "SNEAK-GOVT-PROPOSAL-APPROVAL-ABOUT-TO-PASS",
          protocol: "lido",
          severity: FindingSeverity.Medium,
          type: FindingType.Suspicious,
          metadata: {
            ACCOUNTS:
              mockProposalTracker[mockProposalVoteEvent.args.voteId].voters,
          },
        }),
      ]);
    });
  });
});
