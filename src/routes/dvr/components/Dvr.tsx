import { SceneProps } from '../../../babylon/components/Scene';
import Scene from '../../../babylon/components/Scene';
import React from 'react';

interface DvrProps extends SceneProps {
}

interface DvrState {
}
export default class Dvr extends React.Component<DvrProps, DvrState> {
  public static propTypes = {
  };
  render() {
    return (
      <div>
        <Scene
          canvasId="dvrCanvas"
          width={window.innerWidth}
          height={window.innerHeight} />
      </div>
    );
  };
}
