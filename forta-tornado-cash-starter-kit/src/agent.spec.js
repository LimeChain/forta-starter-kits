const {
  FindingType,
  FindingSeverity,
  Finding,
  createTransactionEvent,
  getEthersProvider,
} = require("forta-agent");
const { provideHandleTranscation } = require("./agent");

describe("TornadoCash contract interactions", () => {
  describe("handleTransaction", () => {
    const mockTxEvent = createTransactionEvent({});
    mockTxEvent.filterLog = jest.fn();
    const mockEthersProvider = { getCode: jest.fn() };
    const handleTransaction = provideHandleTranscation(mockEthersProvider);
    beforeEach(() => {
      mockTxEvent.filterLog.mockReset();
    });

    it("returns empty findings if there are no contract interactions with an account that was funded from TornadoCash", async () => {
      mockTxEvent.filterLog.mockReturnValue([]);
      mockTxEvent.transaction = {};
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);

      expect(mockTxEvent.filterLog).toHaveBeenCalledTimes(1);
    });

    it("returns a finding if there is a contract interaction from an address that was funded from TornadoCash", async () => {
      mockTxEvent.filterLog.mockReturnValue([
        {
          args: {
            to: "0xa",
          },
        },
      ]);

      mockTxEvent.transaction = {
        from: "0xa",
        to: "0xb",
        data: "0x1234567Test",
      };
      mockEthersProvider.getCode.mockReturnValue("0x1234");
      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "Tornado Cash funded account interacted with contract",
          description: `${mockTxEvent.transaction.from} interacted with contract ${mockTxEvent.to}`,
          alertId: "TORNADO-CASH-FUNDED-ACCOUNT-INTERACTION",
          severity: FindingSeverity.Low,
          type: FindingType.Suspicious,
        }),
      ]);
    });
  });
});
