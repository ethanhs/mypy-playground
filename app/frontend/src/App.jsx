import 'bootstrap/dist/css/bootstrap.min.css';
import React, { Component } from 'react';
import ReactGA from 'react-ga';

import './App.css';
import Editor from './Editor';
import Header from './Header';
import Result from './Result';
import { runTypecheck } from './api';
import { fetchGist, shareGist } from './gist';

function parseMessages(messages) {
  const types = {
    error: 'error',
    note: 'info',
  };
  const getType = (level) => {
    const type = types[level];
    return type || 'error';
  };
  const matcher = /^main\.py:(\d+): (\w+): (.+)/;
  return messages.split('\n').map((m) => {
    const match = m.match(matcher);
    return match ? {
      row: match[1] - 1,
      type: getType(match[2]),
      text: match[3],
    } : null;
  }).filter(m => m !== null);
}

export default class App extends Component {
  constructor(props) {
    super(props);

    const context = JSON.parse(document.getElementById('context').textContent);
    const config = {
      mypyVersion: 'latest',
      pythonVersion: '3.7',
    };
    // eslint-disable-next-line no-restricted-syntax
    for (const flag of context.flags_normal) {
      config[flag] = false;
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const flag of context.flags_strict) {
      config[flag] = false;
    }
    this.state = {
      annotations: [],
      config,
      context,
      source: context.initial_code,
      result: {
        status: 'ready',
      },
    };

    this.run = this.run.bind(this);
    this.shareGist = this.shareGist.bind(this);
    this.onChange = this.onChange.bind(this);
    this.updateConfig = this.updateConfig.bind(this);
  }

  componentDidMount() {
    if (this.state.context.ga_tracking_id) {
      ReactGA.initialize(this.state.context.ga_tracking_id);
      ReactGA.pageview(window.location.pathname + window.location.search);
    }

    const params = new URLSearchParams(window.location.search);
    if (params.has('gist')) {
      this.fetchGist(params.get('gist'));
    }
  }

  onChange(source) {
    this.setState({ source });
  }

  updateConfig(configDiff) {
    this.setState({ config: { ...this.state.config, ...configDiff } });
  }

  async run() {
    this.setState({ result: { status: 'running' } });

    try {
      const result = await runTypecheck({
        ...this.state.config,
        source: this.state.source,
      });
      this.setState({
        result: { status: 'succeeded', result },
        annotations: parseMessages(result.stdout),
      });
    } catch (error) {
      this.setState({ result: { status: 'failed', message: error } });
    }
  }

  async shareGist() {
    this.setState({ result: { status: 'creating_gist' } });
    try {
      const { gistUrl, playgroundUrl } = await shareGist(this.state.source);
      this.setState({
        result: {
          status: 'created_gist',
          gistUrl,
          playgroundUrl,
        },
      });
    } catch (error) {
      this.setState({ result: { status: 'failed', message: `Failed to create a gist: ${error}` } });
    }
  }

  async fetchGist(gistId) {
    this.setState({ result: { status: 'fetching_gist' } });
    try {
      const { source } = await fetchGist(gistId);
      this.setState({
        result: {
          status: 'fetched_gist',
        },
        source,
      });
    } catch (error) {
      this.setState({ result: { status: 'failed', message: `Failed to fetch the gist: ${error}` } });
    }
  }

  render() {
    return (
      <div className="App">
        <Header
          context={this.state.context}
          config={this.state.config}
          status={this.state.result.status}
          onGistClick={this.shareGist}
          onRunClick={this.run}
          onConfigChange={this.updateConfig}
        />
        <Editor
          annotations={this.state.annotations}
          onChange={this.onChange}
          code={this.state.source}
        />
        <Result result={this.state.result} />
      </div>
    );
  }
}
