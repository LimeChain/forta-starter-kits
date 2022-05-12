const { ApprovalThreshold } = require("./agent.config");

class AddressApprovalTracker {
  constructor(address, days) {
    this.addressTracked = address;
    this.totalApprovalsForRange = 0;
    this.totalAssetsApproved = 0;
    this.daysTracked = days;
    this.trackingApprovals = [];
    this.trackingTransfers = [];
    this.totalAssetsTransfered = 0;
    this.totalAccountsTransferedFrom = 0;
  }

  addToApprovals(approvedAssetAccount, accountApproved, txHash) {
    this.totalApprovalsForRange++;
    const found = this.trackingApprovals.find(
      (t) =>
        t.approvedAssetAccount == approvedAssetAccount &&
        t.accountApproved == accountApproved
    );

    if (!found) {
      this.totalAssetsApproved++;
    }
    const approvalDate = new Date();
    const trackingObject = {
      approvedAssetAccount,
      accountApproved,
      approvalDate,
      txHash,
    };

    this.trackingApprovals.push(trackingObject);
    this.checkForPassedThresholdApprovals();
  }

  addToTransfers(assetTransfered, accountTransferedFrom, txHash) {
    const isFromAlreadyApproved = this.trackingApprovals.find(
      (t) => t.approvedAssetAccount == assetTransfered
    );

    if (!isFromAlreadyApproved) return;

    const foundAssetTransfered = this.trackingTransfers.find(
      (t) => t.assetTransfered == assetTransfered
    );
    if (!foundAssetTransfered) {
      this.totalAssetsTransfered++;
    }

    const foundAccountTransferedFrom = this.trackingTransfers.find(
      (t) => t.accountTransferedFrom == accountTransferedFrom
    );

    if (!foundAccountTransferedFrom) {
      this.totalAccountsTransferedFrom++;
    }

    const transferedDate = new Date();
    const trackingObject = {
      assetTransfered,
      accountTransferedFrom,
      transferedDate,
      txHash,
    };

    this.trackingTransfers.push(trackingObject);
    this.checkForPassedThresholdTransfers();
  }

  checkForPassedThresholdApprovals() {
    const trackedToRemove = [];
    let totalAssetsApprovedRemoved = [];
    for (let t of this.trackingApprovals) {
      const dateAdded = t.approvalDate;
      const dateNow = new Date();
      const timeDiff = (dateNow - dateAdded) / 1000; //strip the ms
      const seconds = Math.round(timeDiff);
      if (seconds > this.daysTracked) {
        trackedToRemove.push(t);
      }
    }

    totalAssetsApprovedRemoved = trackedToRemove.filter((item, pos) => {
      return trackedToRemove.indexOf(item) == pos;
    });
    this.trackingApprovals = this.trackingApprovals.filter(
      (t) => !trackedToRemove.includes(t)
    );

    //Decrease total approvals for range by the amount of removed approvals that expired
    this.totalApprovalsForRange =
      this.totalApprovalsForRange - trackedToRemove.length;

    //Decrease the total count of assets approved by the amount removed that expired
    this.totalAssetsApproved =
      this.totalAssetsApproved - totalAssetsApprovedRemoved.length;
  }

  checkForPassedThresholdTransfers() {
    const trackedToRemove = [];
    let totalAssetsTransferedRemoved = [];
    let totalAccountsTransferedRemoved = [];
    for (let t of this.trackingTransfers) {
      const dateAdded = t.transferedDate;
      const dateNow = new Date();
      const timeDiff = (dateNow - dateAdded) / 1000; //strip the ms
      const seconds = Math.round(timeDiff);
      if (seconds > this.daysTracked) {
        trackedToRemove.push(t);
      }
    }

    totalAssetsTransferedRemoved = trackedToRemove.filter((item, pos) => {
      return trackedToRemove.indexOf(item) == pos;
    });
    totalAccountsTransferedRemoved = trackedToRemove.filter((item, pos) => {
      return trackedToRemove.indexOf(item) == pos;
    });

    this.trackingTransfers = this.trackingTransfers.filter(
      (t) => !trackedToRemove.includes(t)
    );

    //Decrease total approvals for range by the amount of removed approvals that expired
    this.totalAccountsTransferedFrom =
      this.totalAccountsTransferedFrom - totalAccountsTransferedRemoved.length;

    //Decrease the total count of assets approved by the amount removed that expired
    this.totalAssetsTransfered =
      this.totalAssetsTransfered - totalAssetsTransferedRemoved.length;
  }

  getApprovalCount() {
    return this.trackingApprovals.length;
  }

  isPastThreshold() {
    const FirstTransfer = this.trackingTransfers[0];
    if (!FirstTransfer) {
      return false;
    }
    const DateAdded = FirstTransfer.transferedDate;
    const DateNow = new Date();
    const timeDiff = (DateNow - DateAdded) / 1000;
    const seconds = Math.round(timeDiff);

    if (seconds >= this.daysTracked) {
      return true;
    }
    return false;
  }

  transfersWithApprovedAssetsHappened() {
    return this.trackingTransfers.length > 0 &&
      this.trackingApprovals.length > ApprovalThreshold
      ? true
      : false;
  }

  getApprovedForFlag() {
    const assetsImpactedArr = this.trackingApprovals.map(
      (approval) => approval.approvedAssetAccount
    );

    const assetsImpactedArrFilteredFromDuplicated = assetsImpactedArr.filter(
      (el, index) => assetsImpactedArr.indexOf(el) == index
    );

    const finalObject = {
      toAddress: this.addressTracked,
      startHash: this.trackingApprovals[0].txHash,
      endHash: this.trackingApprovals[this.trackingApprovals.length - 1].txHash,
      assetsImpacted: assetsImpactedArrFilteredFromDuplicated,
      assetsImpactedCount: assetsImpactedArrFilteredFromDuplicated.length,
      accountApproved: this.totalApprovalsForRange,
    };
    this.trackingApprovals = [];
    return finalObject;
  }

  getApprovedTransferedForFlag() {
    const assetsTransferedAddr = this.trackingTransfers.map(
      (transfer) => transfer.assetTransfered
    );
    const assetsTransferedFilteredForDuplicates = assetsTransferedAddr.filter(
      (el, index) => assetsTransferedAddr.indexOf(el) == index
    );
    const finalObject = {
      toAddress: this.addressTracked,
      startHash: this.trackingTransfers[0].txHash,
      endHash: this.trackingTransfers[this.trackingTransfers.length - 1].txHash,
      assetsImpacted: assetsTransferedFilteredForDuplicates,
      assetsImpactedCount: assetsTransferedFilteredForDuplicates.length,
      accountsImpacted: this.totalAccountsTransferedFrom,
    };
    this.trackingTransfers = [];
    return finalObject;
  }
}

module.exports = AddressApprovalTracker;
