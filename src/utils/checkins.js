// Re-export bridge: all checkins functions now live in domain/checkins/
// TODO: update downstream imports to use domain/checkins directly, then delete this file.
export {
  analyzeRecentCheckins,
  generateCheckinAdvice,
} from '../domain/checkins/index.js'
