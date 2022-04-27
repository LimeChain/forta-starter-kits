/*
1)Create a time series tracker for each finding type
2)Add all info based on data to the time series tracker
3)Check for std and std failed
4)Return data
*/
const RollingMath = require("rolling-math");

class TimeSeriesGranularity {
  constructor(blockRange) {
    this.rollingMath = new RollingMath(blockRange);
  }

  AddElement(element) {
    this.rollingMath.addElement(element);
  }

  getStd;
}
