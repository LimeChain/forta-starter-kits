const {
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  ethers,
} = require("forta-agent");
const { provideHandleTranscation } = require("./agent");

describe("TornadoCash contract interactions", () => {
  describe("handleTransaction", () => {
    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.filterLog = jest.fn();
    const mockGetAllFundedFromTornadoCash = jest.fn();
    const mockGetAllInteractedWithContractFundedFromTornadoCash = jest.fn();
    const handleTransaction = provideHandleTranscation(
      mockGetAllFundedFromTornadoCash,
      mockGetAllInteractedWithContractFundedFromTornadoCash
    );
    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
    });

    it("returns empty findings if there are no contract interactions with an account that was funded from TornadoCash", async () => {
      const mockResolvedValueFundedAddress = [];
      const mockResolvedValueInteractedContract = [];

      mockGetAllFundedFromTornadoCash.mockResolvedValueOnce(
        mockResolvedValueFundedAddress
      );
      mockGetAllInteractedWithContractFundedFromTornadoCash.mockResolvedValueOnce(
        mockResolvedValueInteractedContract
      );

      const mockTxHash = {
        blockNumber: 999999,
      };

      const findings = await handleTransaction(mockTxHash);

      expect(findings).toStrictEqual([]);
      expect(mockGetAllFundedFromTornadoCash).toHaveBeenCalledTimes(1);
      expect(
        mockGetAllInteractedWithContractFundedFromTornadoCash
      ).toHaveBeenCalledTimes(1);
    });

    it("returns a finding if there is a contract interaction from an address that was funded from TornadoCash", async () => {
      const mockInteractedTxResult = [
        {
          from: "0x123",
          to: "0x234",
        },
      ];

      const mockTxHash = {
        blockNumber: 999999,
      };
      mockGetAllInteractedWithContractFundedFromTornadoCash.mockResolvedValue(
        mockInteractedTxResult
      );

      const findings = await handleTransaction(mockTxHash);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Tornado Cash funded account interacted with contract",
          description: `${mockInteractedTxResult[0].from} interacted with contract ${mockInteractedTxResult[0].to}`,
          alertId: "TORNADO-CASH-FUNDED-ACCOUNT-INTERACTION",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
        }),
      ]);
    });
  });
});
