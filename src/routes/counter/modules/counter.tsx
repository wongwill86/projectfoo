import { Dispatch } from 'redux';

// Action Constants
export const COUNTER_INCREMENT = 'COUNTER_INCREMENT';
export const COUNTER_DOUBLE_ASYNC = 'COUNTER_DOUBLE_ASYNC';

interface CounterAction {
  type: string;
  payload: number;
}
type CounterState = number;

const initialState: CounterState = 0;

// Action Creators
export function increment(value: number = 1): CounterAction {
  return {
    type: COUNTER_INCREMENT,
    payload: value,
  };
}

// TODO SOmething here isn't right
interface DoubleState {
  counter: number;
}

// THUNK
export const doubleAsync = () => {
  return (dispatch: Dispatch<CounterAction>, getState: () => DoubleState) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        dispatch({
          type: COUNTER_DOUBLE_ASYNC,
          payload: getState().counter,
        });
        resolve();
      }, 200);
    });
  };
};

export const actions = {
  increment,
  doubleAsync,
};

// Action Handlers
const ACTION_HANDLERS = {
  [COUNTER_INCREMENT]: (state: CounterState, action: CounterAction) =>
    state + action.payload,
  [COUNTER_DOUBLE_ASYNC]: (state: CounterState, action: CounterAction) =>
    state * 2,
};

// Reducer
export default function counterReducer(state: CounterState = initialState,
                                       action: CounterAction) {
  const handler = ACTION_HANDLERS[action.type];
  return handler ? handler(state, action) : state;
}
