import './main-layout.css!';
import * as React from 'react';
import { LayoutTopNav, LayoutTopNavLink } from './components/layout-top-nav';
import { LayoutHeader } from './components/layout-header';
import { LayoutMain } from './components/layout-main';
import { LayoutFooter } from './components/layout-footer';

export class MainLayout extends React.Component<{}, {}> {
  render() {
    const {children} = this.props;

    return (
      <div className="c-text">
        <LayoutHeader>
          <LayoutTopNav>
            <LayoutTopNavLink href="/" isPrimary> Home </LayoutTopNavLink>
            <LayoutTopNavLink href="/counter"> Counter </LayoutTopNavLink>
            <LayoutTopNavLink href="/Dvr"> Dvr </LayoutTopNavLink>
            <LayoutTopNavLink href="/Fancy"> Fancy </LayoutTopNavLink>
          </LayoutTopNav>
        </LayoutHeader>

        <LayoutMain>
          {children}
        </LayoutMain>

        <LayoutFooter>
          2016 &copy; Will<br />
          <a href=
            "https://github.com/wongwill86/projectfoo">
          Back to GitHub Repo</a>
        </LayoutFooter>
      </div>
    );
  };
};
