// Action Constants
export const COUNTER_INCREMENT = 'COUNTER_INCREMENT';
export const COUNTER_DOUBLE_ASYNC = 'COUNTER_DOUBLE_ASYNC';

interface DvrAction {
  type: string;
  payload: number;
}
type DvrState = {
};

const initialState: DvrState = {};

// Action Creators

export const actions = {
};

// Action Handlers
const ACTION_HANDLERS: { [id: string]:
  (state: DvrState, action: DvrAction) => DvrState } = {};

// Reducer
export default function counterReducer(state: DvrState = initialState,
                                       action: DvrAction) {
  const handler = ACTION_HANDLERS[action.type];
  return handler ? handler(state, action) : state;
}
