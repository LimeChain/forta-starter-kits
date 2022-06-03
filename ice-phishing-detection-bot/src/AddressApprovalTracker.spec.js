const AddressApprovalTracker = require("./AddressApprovalTracker");

describe("Address Approval Tracker", () => {
  const AddressApprovalTrackerTemp = new AddressApprovalTracker("0x123", 1);
  it("Should successfully create an object of type AddressApprovalTracker", () => {
    expect(AddressApprovalTrackerTemp).not.toBe(null);
  });

  it("Should successfully add to approvals", () => {
    AddressApprovalTrackerTemp.addToApprovals("0x123", "0x123", "0x123");
    expect(AddressApprovalTrackerTemp.trackingApprovals.length).toBe(1);
  });

  it("Should successfully add to transfers", () => {
    AddressApprovalTrackerTemp.addToTransfers("0x123", "0x123", "0x123");
    expect(AddressApprovalTrackerTemp.trackingTransfers.length).toBe(1);
  });

  it("Should get approval count", () => {
    expect(AddressApprovalTrackerTemp.getApprovalCount()).not.toBe(null);
  });

  it("Should return false for IsPastThreshold", () => {
    expect(AddressApprovalTrackerTemp.isPastThreshold()).toBe(false);
  });

  it("Should return an object from get approved for flag", () => {
    expect(AddressApprovalTrackerTemp.getApprovedForFlag()).not.toBe(null);
  });

  it("Should return an object from get approved transfered for flag ", () => {
    expect(AddressApprovalTrackerTemp.getApprovedTransferedForFlag()).not.toBe(
      null
    );
  });
});
