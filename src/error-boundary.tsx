import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

// Without a boundary a render throw unmounts the whole view and leaves an
// empty pane with no message and no way to recover.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="fragments-error" role="alert">
        <p>Something went wrong rendering Fragments.</p>
        <button onClick={() => this.setState({ failed: false })}>Try again</button>
      </div>
    );
  }
}
