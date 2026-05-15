// Composable: usePlanActions — app action facade.
// Concrete action groups live under ./actions/ to keep this file as a thin composition layer.
import { createActionContext } from './actions/actionContext.js'
import { useDataActions } from './actions/useDataActions.js'
import { useFoodActions } from './actions/useFoodActions.js'
import { useMealActions } from './actions/useMealActions.js'
import { useProfileActions } from './actions/useProfileActions.js'
import { useRecordActions } from './actions/useRecordActions.js'
import { nextPlanSeed } from '../utils/planSeed.js'

export function usePlanActions(deps) {
  const ctx = createActionContext(deps)

  return {
    ...useMealActions(ctx),
    ...useFoodActions(ctx),
    ...useProfileActions(ctx),
    ...useRecordActions(ctx),
    ...useDataActions(ctx),
    nextPlanSeed,
  }
}
