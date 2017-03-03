import React from 'react';
import { PageHero } from '../../components/page-hero';
import { PageSection } from '../../components/page-section';
import { Link } from 'react-router';
export default () => ({
  path: '/',
  component : () =>
    <article>
      <PageHero title="Welcome to" subtitle="Project Foo" />
      <PageSection className="o-container o-container--small">
        <p>
          Temporary links below!
        </p>
        <ul>
          <li>
            <Link to="/Counter">Counter App</Link> - (work in progress)
          </li>
        </ul>
        <br />
        <div className="c-alert c-alert--info">
          Note: Open Redux DevTools Inspector
        </div>
      </PageSection>
      <br />
    </article>,
});
