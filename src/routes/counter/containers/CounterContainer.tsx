import { increment, doubleAsync } from '../modules/counter';
import Counter from '../components/Counter';
import { connect } from 'react-redux';

const mapStateToProps = (state: any) => ({
  counter: state.counter,
});

const mapDispatchToProps = {
  increment: () => increment(1),
  doubleAsync,
};

export default connect(mapStateToProps, mapDispatchToProps)(Counter);
