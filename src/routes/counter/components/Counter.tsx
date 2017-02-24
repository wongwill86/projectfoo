import React from 'react';

interface CounterProps {
  counter: number;
  doubleAsync: () => void;
  increment: () => void;
}

interface CounterState {
}

export default
class Counter extends React.Component<CounterProps, CounterState> {
  public static propTypes = {
    counter: React.PropTypes.number.isRequired,
    doubleAsync: React.PropTypes.func.isRequired,
    increment: React.PropTypes.func.isRequired,
  };
  render() {
    return (
      <div style={{ margin: '0 auto' }} >
        <h2> My Counter: {this.props.counter}</h2>
        <button className="btn btn-default" onClick={this.props.increment}>
          Increment
        </button>
        {'.'}
        <button className="btn btn-default" onClick={this.props.doubleAsync}>
          Double (Async)
        </button>
      </div>
    );
  };
}
