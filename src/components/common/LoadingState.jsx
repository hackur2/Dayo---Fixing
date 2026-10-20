function LoadingState({ message = "Loading data..." }) {
  return (
    <div className="state-card loading-state">
      <div className="loading-spinner" aria-hidden="true" />

      <div>
        <strong>Loading</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

export default LoadingState;