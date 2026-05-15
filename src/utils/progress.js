// Re-export bridge: all body-records functions now live in domain/body-records/
// TODO: update downstream imports to use domain/body-records directly, then delete this file.
export {
  analyzeWeightTrend,
  generateAdvice,
  getTargetCurve,
  calculateMovingAverage,
  buildWeightChartData,
} from '../domain/body-records/index.js'
